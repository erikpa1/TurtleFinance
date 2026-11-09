package companies

import (
	"time"

	"turtle/db"
	"turtle/tools"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ParseUids decodes a JSON string array of hex ObjectIDs, skipping invalid ones.
func ParseUids(raw string) []primitive.ObjectID {
	result := []primitive.ObjectID{}

	for _, s := range tools.VecFromJStr[string](raw) {
		if oid, err := primitive.ObjectIDFromHex(s); err == nil {
			result = append(result, oid)
		}
	}
	return result
}

func SetSyncError(org primitive.ObjectID, uid primitive.ObjectID, msg string) error {
	return db.SetByOrgAndId(CT_COMPANIES, uid, org, bson.M{"syncError": msg})
}

func SetPriceSync(org primitive.ObjectID, uid primitive.ObjectID, at time.Time) {
	db.SetByOrgAndId(CT_COMPANIES, uid, org, bson.M{"lastPriceSync": at})
}
