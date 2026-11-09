package tools

import (
	"encoding/json"

	"turtle/core/lgr"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func VecFromJStr[T any](data string) []T {

	if data == "" {
		return []T{}
	} else {
		var result []T
		err := json.Unmarshal([]byte(data), &result)

		if err != nil {
			lgr.ErrorStack("invalid JSON: %s", data)
		}

		return result
	}

}

func ObjFromJsonPtr[T any](data string) *T {
	var result = new(T)
	err := json.Unmarshal([]byte(data), &result)

	if err != nil {
		lgr.ErrorStack("%s JSON: %s", err.Error(), data)
		return nil
	}

	return result
}

func QueryBsonHeader(c *gin.Context) bson.M {
	tmp := QueryHeader[bson.M](c)
	JsonToBson(tmp)
	return tmp
}

func QueryHeader[T any](c *gin.Context) T {
	var result T

	headerValue := c.GetHeader("query")
	err := json.Unmarshal([]byte(headerValue), &result)

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
		return result
	}
	return result
}

func JsonToBson(data bson.M) {
	for key, value := range data {
		switch v := value.(type) {
		case map[string]interface{}:
			// Check if it's an $oid structure
			if oidStr, ok := v["$oid"].(string); ok {
				if objID, err := primitive.ObjectIDFromHex(oidStr); err == nil {
					data[key] = objID
				}
			} else {
				// Recurse deeper
				JsonToBson(v)
			}
		case []interface{}:
			for i, item := range v {
				if itemMap, ok := item.(map[string]interface{}); ok {
					JsonToBson(itemMap)
					v[i] = itemMap
				}
			}
		}
	}
}

func ObjFromJson[T any](data string) T {
	var result T
	err := json.Unmarshal([]byte(data), &result)

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
		return result
	}

	return result
}
