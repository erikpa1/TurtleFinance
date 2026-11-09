package tags

import (
	"strings"
	"turtle/core/users"
	"turtle/db"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const CT_TAGS = "finance_tags"

// CT_COMPANIES is duplicated here (instead of importing companies) to avoid an
// import cycle: companies imports tags for bulk tagging.
const CT_COMPANIES = "finance_companies"

func ListTags(user *users.User) []Tag {
	result := db.QueryEntitiesAsCopy[Tag](CT_TAGS, user.FillOrgQuery(bson.M{}))

	for i := range result {
		result[i].Count = db.CountEntities(CT_COMPANIES, user.FillOrgQuery(bson.M{"tags": result[i].Uid}))
	}

	return result
}

func COUTag(user *users.User, tag *Tag) {
	tag.Org = user.Org
	tag.Name = strings.TrimSpace(tag.Name)

	if tag.Type == "" {
		tag.Type = TAG_TYPE_USER
	}
	if tag.Color == "" {
		tag.Color = "#1677ff"
	}

	if tag.Uid.IsZero() {
		res, err := db.InsertEntity(CT_TAGS, tag)
		if err == nil {
			tag.Uid = res.InsertedID.(primitive.ObjectID)
		}
	} else {
		db.SetByOrgAndId(CT_TAGS, tag.Uid, tag.Org, tag)
	}
}

func DeleteTag(user *users.User, uid primitive.ObjectID) {
	db.DeleteEntity(CT_TAGS, user.FillOrgQuery(bson.M{"_id": uid}))
	db.UpdateMany(CT_COMPANIES, user.FillOrgQuery(bson.M{"tags": uid}), bson.M{"$pull": bson.M{"tags": uid}})
}

// EnsureTag returns the tag with the given name, creating it when missing.
func EnsureTag(org primitive.ObjectID, name string, tagType string, color string, description string) primitive.ObjectID {
	existing := db.QueryEntity[Tag](CT_TAGS, bson.M{"org": org, "name": name})
	if existing != nil {
		return existing.Uid
	}

	tag := &Tag{Org: org, Name: name, Type: tagType, Color: color, Description: description}
	res, err := db.InsertEntity(CT_TAGS, tag)
	if err != nil {
		return primitive.NilObjectID
	}
	return res.InsertedID.(primitive.ObjectID)
}
