package serverKit

import (
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func MongoObjectIdFromQuery(c *gin.Context) primitive.ObjectID {
	objectId, err := primitive.ObjectIDFromHex(c.Query("uid"))
	if err != nil {
		return primitive.NilObjectID
	}
	return objectId
}

func MongoObjectIdFromQueryByKey(c *gin.Context, key string) primitive.ObjectID {
	objectId, err := primitive.ObjectIDFromHex(c.Query(key))
	if err != nil {
		return primitive.NilObjectID
	}
	return objectId
}
