package categories

import (
	"context"
	"strings"
	"turtle/core/lgr"
	"turtle/core/users"
	"turtle/db"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const CT_CATEGORIES = "finance_categories"
const CT_COMPANIES = "finance_companies"

func ListCategories(user *users.User) []Category {
	EnsureDefaults(user.Org, false)

	opts := options.Find().SetSort(bson.D{{Key: "group", Value: 1}, {Key: "order", Value: 1}, {Key: "name", Value: 1}})
	result := db.QueryEntitiesAsCopy[Category](CT_CATEGORIES, user.FillOrgQuery(bson.M{}), opts)

	for i := range result {
		result[i].Count = db.CountEntities(CT_COMPANIES, user.FillOrgQuery(bson.M{"categories.key": result[i].Key}))
	}

	return result
}

// ListForOrg returns raw categories (no counts) – used for prompts.
func ListForOrg(org primitive.ObjectID) []Category {
	EnsureDefaults(org, false)
	return db.QueryEntitiesAsCopy[Category](CT_CATEGORIES, bson.M{"org": org})
}

// EnsureDefaults seeds the default taxonomy. With force=false it only seeds
// an empty org; with force=true it re-creates missing default keys.
func EnsureDefaults(org primitive.ObjectID, force bool) {
	if !force && db.CountEntities(CT_CATEGORIES, bson.M{"org": org}) > 0 {
		return
	}

	for i, def := range DefaultCategories {
		if db.EntityExists(CT_CATEGORIES, bson.M{"org": org, "key": def.Key}) {
			continue
		}

		c := def
		c.Org = org
		c.Order = i
		db.InsertEntity(CT_CATEGORIES, &c)
	}
}

func NormalizeKey(key string) string {
	key = strings.ToLower(strings.TrimSpace(key))
	key = strings.NewReplacer(" ", "_", "-", "_", "/", "_").Replace(key)
	return key
}

func COUCategory(user *users.User, c *Category) {
	c.Org = user.Org
	c.Key = NormalizeKey(c.Key)
	if c.Key == "" {
		c.Key = NormalizeKey(c.Name)
	}
	if c.Group == "" {
		c.Group = GROUP_OTHER
	}

	if c.Uid.IsZero() {
		res, err := db.InsertEntity(CT_CATEGORIES, c)
		if err == nil {
			c.Uid = res.InsertedID.(primitive.ObjectID)
		}
	} else {
		previous := db.GetByIdAndOrg[Category](CT_CATEGORIES, c.Uid, user.Org)
		db.SetByOrgAndId(CT_CATEGORIES, c.Uid, c.Org, c)

		// Keep company assignments consistent when the key is renamed.
		if previous != nil && previous.Key != c.Key {
			opts := options.Update().SetArrayFilters(options.ArrayFilters{
				Filters: []interface{}{bson.M{"el.key": previous.Key}},
			})
			_, err := db.DB.Col(CT_COMPANIES).UpdateMany(context.TODO(),
				user.FillOrgQuery(bson.M{"categories.key": previous.Key}),
				bson.M{"$set": bson.M{"categories.$[el].key": c.Key}}, opts)
			if err != nil {
				lgr.Error("rename category key: %s", err.Error())
			}
		}
	}
}

func DeleteCategory(user *users.User, uid primitive.ObjectID) {
	c := db.GetByIdAndOrg[Category](CT_CATEGORIES, uid, user.Org)
	if c == nil {
		return
	}

	db.DeleteEntity(CT_CATEGORIES, user.FillOrgQuery(bson.M{"_id": uid}))
	db.UpdateMany(CT_COMPANIES, user.FillOrgQuery(bson.M{}), bson.M{"$pull": bson.M{"categories": bson.M{"key": c.Key}}})
}
