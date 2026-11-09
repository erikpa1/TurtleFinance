package jobs

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"turtle/core/lgr"
	"turtle/core/users"
	"turtle/db"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CT_JOBS = "finance_jobs"

const MAX_ERRORS = 200

// Ctx is handed to the job function to report progress.
type Ctx struct {
	job *Job
	mu  sync.Mutex
	// lastFlush throttles DB writes for chatty progress updates.
	lastFlush time.Time
}

var running = map[primitive.ObjectID]*Ctx{}
var runningMu sync.Mutex

// Start runs fn in a goroutine and returns the job immediately.
func Start(org primitive.ObjectID, jobType string, name string, fn func(ctx *Ctx) (any, error)) *Job {
	job := &Job{
		Uid:       primitive.NewObjectID(),
		Org:       org,
		Type:      jobType,
		Name:      name,
		Status:    JOB_RUNNING,
		Errors:    []string{},
		StartedAt: time.Now(),
	}

	db.InsertEntity(CT_JOBS, job)

	ctx := &Ctx{job: job}

	runningMu.Lock()
	running[job.Uid] = ctx
	runningMu.Unlock()

	go func() {
		var result any
		var err error

		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("panic: %v", r)
				lgr.ErrorStack("job %s panicked: %v", name, r)
			}
			ctx.finish(result, err)

			runningMu.Lock()
			delete(running, job.Uid)
			runningMu.Unlock()
		}()

		result, err = fn(ctx)
	}()

	return job
}

func (self *Ctx) SetTotal(total int) {
	self.mu.Lock()
	self.job.Total = total
	self.mu.Unlock()
	self.flush(false)
}

func (self *Ctx) SetMessage(format string, args ...any) {
	self.mu.Lock()
	self.job.Message = fmt.Sprintf(format, args...)
	self.mu.Unlock()
	self.flush(false)
}

// Step marks one unit done; err (optional) is collected into job.Errors.
func (self *Ctx) Step(label string, err error) {
	self.mu.Lock()
	self.job.Done++
	if self.job.Total > 0 {
		self.job.Progress = float64(self.job.Done) / float64(self.job.Total)
	}
	self.job.Message = label
	if err != nil && len(self.job.Errors) < MAX_ERRORS {
		self.job.Errors = append(self.job.Errors, fmt.Sprintf("%s: %s", label, err.Error()))
	}
	self.mu.Unlock()
	self.flush(false)
}

func (self *Ctx) flush(force bool) {
	self.mu.Lock()
	if !force && time.Since(self.lastFlush) < 700*time.Millisecond {
		self.mu.Unlock()
		return
	}
	self.lastFlush = time.Now()
	snapshot := *self.job
	snapshot.Errors = append([]string{}, self.job.Errors...)
	self.mu.Unlock()

	db.SetById(CT_JOBS, snapshot.Uid, snapshot)
}

func (self *Ctx) finish(result any, err error) {
	self.mu.Lock()
	now := time.Now()
	self.job.FinishedAt = &now
	self.job.Result = jsonNormalize(result)
	self.job.Progress = 1

	if err != nil {
		self.job.Status = JOB_FAILED
		self.job.Message = err.Error()
	} else {
		self.job.Status = JOB_DONE
		if self.job.Message == "" || self.job.Total > 0 {
			self.job.Message = fmt.Sprintf("Finished (%d/%d, %d errors)", self.job.Done, self.job.Total, len(self.job.Errors))
		}
	}
	self.mu.Unlock()

	self.flush(true)
	lgr.Ok("Job %s finished: %s", self.job.Name, self.job.Status)
}

// snapshot returns the live in-memory state when the job is still running.
func snapshot(uid primitive.ObjectID) *Job {
	runningMu.Lock()
	ctx, ok := running[uid]
	runningMu.Unlock()

	if !ok {
		return nil
	}

	ctx.mu.Lock()
	defer ctx.mu.Unlock()
	copyJob := *ctx.job
	copyJob.Errors = append([]string{}, ctx.job.Errors...)
	copyJob.Result = nil
	return &copyJob
}

func ListJobs(user *users.User) []Job {
	opts := options.Find().SetSort(bson.M{"startedAt": -1}).SetLimit(50).SetProjection(bson.M{"result": 0})
	result := db.QueryEntitiesAsCopy[Job](CT_JOBS, user.FillOrgQuery(bson.M{}), opts)

	for i := range result {
		if live := snapshot(result[i].Uid); live != nil {
			result[i] = *live
		}
	}

	return result
}

func GetJob(user *users.User, uid primitive.ObjectID) *Job {
	if live := snapshot(uid); live != nil && live.Org == user.Org {
		return live
	}
	return db.GetByIdAndOrg[Job](CT_JOBS, uid, user.Org)
}

func CountRunning(org primitive.ObjectID) int {
	runningMu.Lock()
	defer runningMu.Unlock()

	count := 0
	for _, ctx := range running {
		if ctx.job.Org == org {
			count++
		}
	}
	return count
}

// MarkInterrupted flags jobs left "running" by a previous process as failed.
func MarkInterrupted() {
	db.UpdateMany(CT_JOBS, bson.M{"status": JOB_RUNNING}, bson.M{"$set": bson.M{
		"status":  JOB_FAILED,
		"message": "Interrupted by server restart",
	}})
}

// jsonNormalize round-trips a result through JSON so it is stored with the
// same (camelCase) keys the API returns, regardless of struct bson tags.
func jsonNormalize(v any) any {
	if v == nil {
		return nil
	}

	data, err := json.Marshal(v)
	if err != nil {
		return v
	}

	var out any
	if err := json.Unmarshal(data, &out); err != nil {
		return v
	}
	return out
}
