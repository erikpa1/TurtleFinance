package categories

import "go.mongodb.org/mongo-driver/bson/primitive"

const (
	GROUP_ESSENTIALS = "essentials"
	GROUP_VICE       = "vice"
	GROUP_STRATEGIC  = "strategic"
	GROUP_ESG        = "esg"
	GROUP_OTHER      = "other"
)

// Category is a thematic bucket used for AI classification of companies
// (e.g. basic food, critical infrastructure, addictive substances).
// Description is injected into the LLM prompt, so it should be precise.
type Category struct {
	Uid         primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org         primitive.ObjectID `json:"org" bson:"org"`
	Key         string             `json:"key" bson:"key"`
	Name        string             `json:"name" bson:"name"`
	Description string             `json:"description" bson:"description"`
	Color       string             `json:"color" bson:"color"`
	Group       string             `json:"group" bson:"group"`
	Order       int                `json:"order" bson:"order"`
	Count       int64              `json:"count" bson:"-"`
}

// Assignment links a company to a category (stored on the company).
type Assignment struct {
	Key        string  `json:"key" bson:"key"`
	Confidence float64 `json:"confidence" bson:"confidence"`
	Reason     string  `json:"reason" bson:"reason"`
}
