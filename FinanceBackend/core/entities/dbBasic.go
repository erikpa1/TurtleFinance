package entities

import "go.mongodb.org/mongo-driver/bson/primitive"

type EntityMinimal struct {
	Uid  primitive.ObjectID `json:"uid" bson:"_id,omitempty"`
	Org  primitive.ObjectID `json:"org"`
	Name string             `json:"name"`
}
