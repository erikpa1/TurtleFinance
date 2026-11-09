package jobs

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	JOB_QUEUED  = "queued"
	JOB_RUNNING = "running"
	JOB_DONE    = "done"
	JOB_FAILED  = "failed"
)

// Job is a background task (price sync, index import, bulk classification,
// forecast lab). Progress is kept in memory and persisted periodically.
type Job struct {
	Uid        primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org        primitive.ObjectID `json:"org" bson:"org"`
	Type       string             `json:"type" bson:"type"`
	Name       string             `json:"name" bson:"name"`
	Status     string             `json:"status" bson:"status"`
	Progress   float64            `json:"progress" bson:"progress"`
	Total      int                `json:"total" bson:"total"`
	Done       int                `json:"done" bson:"done"`
	Message    string             `json:"message" bson:"message"`
	Errors     []string           `json:"errors" bson:"errors"`
	Result     any                `json:"result,omitempty" bson:"result,omitempty"`
	StartedAt  time.Time          `json:"startedAt" bson:"startedAt"`
	FinishedAt *time.Time         `json:"finishedAt,omitempty" bson:"finishedAt,omitempty"`
}
