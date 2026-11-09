package ai

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	KIND_ANALYSIS       = "analysis"
	KIND_CLASSIFICATION = "classification"
	KIND_QUESTION       = "question"
)

type AiAnalysis struct {
	Uid        primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org        primitive.ObjectID `json:"org" bson:"org"`
	CompanyUid primitive.ObjectID `json:"companyUid" bson:"companyUid"`
	Ticker     string             `json:"ticker" bson:"ticker"`
	Model      string             `json:"model" bson:"model"`
	Kind       string             `json:"kind" bson:"kind"`
	Question   string             `json:"question" bson:"question"`
	Content    string             `json:"content" bson:"content"`
	CreatedAt  time.Time          `json:"createdAt" bson:"createdAt"`
}

type AiStatus struct {
	Online       bool          `json:"online"`
	Host         string        `json:"host"`
	DefaultModel string        `json:"defaultModel"`
	Models       []OllamaModel `json:"models"`
	Error        string        `json:"error,omitempty"`
}
