package tags

import "go.mongodb.org/mongo-driver/bson/primitive"

const (
	TAG_TYPE_USER  = "user"
	TAG_TYPE_INDEX = "index"
)

type Tag struct {
	Uid         primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org         primitive.ObjectID `json:"org" bson:"org"`
	Name        string             `json:"name" bson:"name"`
	Color       string             `json:"color" bson:"color"`
	Type        string             `json:"type" bson:"type"`
	Description string             `json:"description" bson:"description"`
	// Count is computed on listing (number of companies carrying the tag).
	Count int64 `json:"count" bson:"-"`
}
