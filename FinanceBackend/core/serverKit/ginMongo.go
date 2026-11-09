package serverKit

import (
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func PrimitiveFromUidQuery(c *gin.Context) primitive.ObjectID {
	uidStr := c.Query("uid")

	objectID, err := primitive.ObjectIDFromHex(uidStr)
	if err != nil {
		return primitive.NilObjectID
	}

	return objectID
}
