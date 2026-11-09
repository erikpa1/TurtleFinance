package ai

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"turtle/core/users"
	"turtle/db"
	"turtle/finance/categories"
	"turtle/finance/companies"
	"turtle/finance/forecasting"
	"turtle/finance/jobs"
	"turtle/finance/prices"
	"turtle/finance/settings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CT_AI_ANALYSES = "finance_ai_analyses"

const MIN_CONFIDENCE = 0.35
const MAX_CATEGORIES = 6
const MAX_ASK_COMPANIES = 80

// pickModel resolves host + model. An explicitly requested model is used as
// is; otherwise the configured default, or – when that is not installed – the
// first installed chat model (embedding / function-calling models are skipped).
func pickModel(org primitive.ObjectID, model string) (string, string) {
	s := settings.GetForOrg(org)
	if strings.TrimSpace(model) != "" {
		return s.OllamaHost, model
	}

	installed, err := ListModels(s.OllamaHost)
	if err != nil || len(installed) == 0 {
		return s.OllamaHost, s.DefaultModel
	}

	return s.OllamaHost, resolveDefault(s.DefaultModel, installed)
}

func resolveDefault(preferred string, installed []OllamaModel) string {
	for _, m := range installed {
		if m.Name == preferred || strings.TrimSuffix(m.Name, ":latest") == preferred {
			return m.Name
		}
	}
	for _, m := range installed {
		name := strings.ToLower(m.Name)
		if !strings.Contains(name, "embed") && !strings.Contains(name, "function") {
			return m.Name
		}
	}
	return preferred
}

func Status(user *users.User) AiStatus {
	s := settings.Get(user)
	status := AiStatus{Host: s.OllamaHost, DefaultModel: s.DefaultModel, Models: []OllamaModel{}}

	models, err := ListModels(s.OllamaHost)
	if err != nil {
		status.Error = err.Error()
		return status
	}

	status.Online = true
	status.Models = models
	status.DefaultModel = resolveDefault(s.DefaultModel, models)
	return status
}

// Classify asks the LLM to assign thematic categories and stores them.
func Classify(org primitive.ObjectID, c *companies.Company, model string) error {
	host, model := pickModel(org, model)
	cats := categories.ListForOrg(org)

	answer, err := Chat(host, model, classificationSystem, classificationPrompt(c, cats), true)
	if err != nil {
		return err
	}

	var parsed struct {
		Categories []categories.Assignment `json:"categories"`
		Summary    string                  `json:"summary"`
	}
	if err := json.Unmarshal([]byte(extractJson(answer)), &parsed); err != nil {
		return fmt.Errorf("model returned invalid JSON: %s", truncate(answer, 160))
	}

	valid := map[string]bool{}
	for _, cat := range cats {
		valid[cat.Key] = true
	}

	// Keep only known keys with sufficient confidence, best first, deduplicated.
	seen := map[string]bool{}
	assignments := []categories.Assignment{}
	for _, a := range parsed.Categories {
		a.Key = categories.NormalizeKey(a.Key)
		if a.Confidence > 1 {
			a.Confidence /= 100 // some models answer in percent
		}
		if !valid[a.Key] || seen[a.Key] || a.Confidence < MIN_CONFIDENCE {
			continue
		}
		seen[a.Key] = true
		assignments = append(assignments, a)
	}

	for i := 1; i < len(assignments); i++ {
		for j := i; j > 0 && assignments[j].Confidence > assignments[j-1].Confidence; j-- {
			assignments[j], assignments[j-1] = assignments[j-1], assignments[j]
		}
	}
	if len(assignments) > MAX_CATEGORIES {
		assignments = assignments[:MAX_CATEGORIES]
	}

	err = companies.SetCategories(org, c.Uid, assignments, &companies.Classification{
		Model: model, At: time.Now(), Summary: parsed.Summary, Manual: false,
	})
	if err != nil {
		return err
	}

	lines := []string{fmt.Sprintf("**Summary:** %s\n", parsed.Summary)}
	for _, a := range assignments {
		lines = append(lines, fmt.Sprintf("- `%s` (%.0f%%) – %s", a.Key, a.Confidence*100, a.Reason))
	}
	saveAnalysis(org, c, model, KIND_CLASSIFICATION, "", strings.Join(lines, "\n"))

	return nil
}

func StartClassifyJob(org primitive.ObjectID, uids []primitive.ObjectID, onlyUnclassified bool, model string) *jobs.Job {
	return jobs.Start(org, "classify", "AI classification", func(ctx *jobs.Ctx) (any, error) {
		host, resolved := pickModel(org, model)
		if _, err := ListModels(host); err != nil {
			return nil, err
		}

		query := bson.M{}
		if len(uids) > 0 {
			query["_id"] = bson.M{"$in": uids}
		}
		if onlyUnclassified {
			query["$or"] = []bson.M{{"categories": bson.M{"$size": 0}}, {"categories": nil}, {"categories": bson.M{"$exists": false}}}
		}

		list := companies.ListForOrg(org, query)
		ctx.SetTotal(len(list))

		ok := 0
		for i := range list {
			err := Classify(org, &list[i], resolved)
			if err == nil {
				ok++
			}
			ctx.Step(list[i].Ticker, err)

			// Abort early when the model itself is missing – every call would fail.
			if err != nil && strings.Contains(err.Error(), "not installed") {
				return nil, err
			}
		}
		return bson.M{"classified": ok, "total": len(list), "model": resolved}, nil
	})
}

func Analyze(user *users.User, uid primitive.ObjectID, model string, question string) (*AiAnalysis, error) {
	c := companies.GetCompany(user, uid)
	if c == nil {
		return nil, errors.New("company not found")
	}

	host, model := pickModel(user.Org, model)

	var season *forecasting.SeasonalityResult
	if bars := prices.LoadBars(user.Org, uid, "", ""); len(bars) > 300 {
		season = forecasting.Seasonality(bars, 15)
	}

	answer, err := Chat(host, model, analysisSystem, analysisPrompt(c, season, question), false)
	if err != nil {
		return nil, err
	}

	kind := KIND_ANALYSIS
	if strings.TrimSpace(question) != "" {
		kind = KIND_QUESTION
	}
	return saveAnalysis(user.Org, c, model, kind, question, answer), nil
}

func Ask(user *users.User, uids []primitive.ObjectID, model string, question string) (string, error) {
	if strings.TrimSpace(question) == "" {
		return "", errors.New("question is required")
	}

	query := bson.M{}
	if len(uids) > 0 {
		query["_id"] = bson.M{"$in": uids}
	}
	list := companies.ListCompanies(user, query)
	if len(list) > MAX_ASK_COMPANIES {
		list = list[:MAX_ASK_COMPANIES]
	}
	if len(list) == 0 {
		return "", errors.New("no companies selected")
	}

	host, model := pickModel(user.Org, model)
	system := "You are an equity research assistant. Answer in Markdown using only the table provided; cite tickers. Flag missing data (n/a). No personal financial advice."
	return Chat(host, model, system, portfolioPrompt(list, question), false)
}

func saveAnalysis(org primitive.ObjectID, c *companies.Company, model, kind, question, content string) *AiAnalysis {
	a := &AiAnalysis{
		Org: org, CompanyUid: c.Uid, Ticker: c.Ticker, Model: model, Kind: kind,
		Question: question, Content: content, CreatedAt: time.Now(),
	}
	if res, err := db.InsertEntity(CT_AI_ANALYSES, a); err == nil {
		a.Uid = res.InsertedID.(primitive.ObjectID)
	}
	return a
}

func ListAnalyses(user *users.User, companyUid primitive.ObjectID) []AiAnalysis {
	opts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(100)
	return db.QueryEntitiesAsCopy[AiAnalysis](CT_AI_ANALYSES, user.FillOrgQuery(bson.M{"companyUid": companyUid}), opts)
}

func DeleteAnalysis(user *users.User, uid primitive.ObjectID) {
	db.DeleteEntity(CT_AI_ANALYSES, user.FillOrgQuery(bson.M{"_id": uid}))
}
