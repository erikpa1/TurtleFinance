package db

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"turtle/core/lgr"
	"turtle/credentials"
	"turtle/tools"

	"go.mongodb.org/mongo-driver/bson/primitive"

	"github.com/tidwall/gjson"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type AnyDBConnection struct {
	Mongo    *mongo.Client
	Context  *context.Context
	IsCosmos bool
}

var DB = NewAnyDBConnection()

func (self *AnyDBConnection) Col(name string) *mongo.Collection {
	return DB.Mongo.Database(credentials.GetDBName()).Collection(name)
}

func (self *AnyDBConnection) Db(name string) *mongo.Database {
	return DB.Mongo.Database(credentials.GetDBName())
}

func (self *AnyDBConnection) QueryEntity(collection string, query bson.M) *any {
	var elem any
	err := self.Col(collection).FindOne(context.TODO(), query).Decode(&elem)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil
		}
		return nil
	}
	return &elem
}
func (self *AnyDBConnection) QueryEntitiesCursor(collectionName string, query bson.M, projection bson.M) (*mongo.Cursor, error) {
	collection := self.Col(collectionName)
	// Access the collection from the MongoDB client
	if projection == nil {
		projection = bson.M{}
	}

	findOptions := options.Find().SetProjection(projection)
	cursor, err := collection.Find(context.Background(), query, findOptions)
	if err != nil {
		return nil, err
	}
	return cursor, nil
}

func GetByIdAndOrg[T any](collection string, _id primitive.ObjectID, orgId primitive.ObjectID) *T {
	return QueryEntity[T](collection, bson.M{
		"_id": _id, "org": orgId,
	})
}

func QueryEntity[T any](collection string, query bson.M) *T {
	var elem T
	err := DB.Col(collection).FindOne(context.TODO(), query).Decode(&elem)

	if err != nil {

		if err == mongo.ErrNoDocuments {
			return nil
		} else {
			lgr.ErrorStack("%s", err.Error())
		}
		return nil
	}
	return &elem
}

func InsertEntity(collection string, entity any) (*mongo.InsertOneResult, error) {
	result, err := DB.Col(collection).InsertOne(context.TODO(), entity)
	if err != nil {
		lgr.Error("%s", err.Error())
	}

	return result, err
}

func InsertMany(collection string, entities []interface{}) {
	_, err := DB.Col(collection).InsertMany(context.TODO(), entities)
	if err != nil {
		lgr.ErrorStack("%s", err.Error())
	}
}

func DeleteByIdAndOrg(collection string, _id primitive.ObjectID, org primitive.ObjectID) error {

	deleteQuery := bson.M{
		"_id": _id,
		"org": org,
	}

	lgr.ErrorJson(deleteQuery)

	_, err := DB.Col(collection).DeleteOne(context.TODO(), deleteQuery)
	if err != nil {
		lgr.Error("%s", err.Error())
	}

	return err
}

func DeleteEntity(collection string, query bson.M) {
	_, err := DB.Col(collection).DeleteOne(context.TODO(), query)
	if err != nil {
		lgr.Error("%s", err.Error())
	}
}

func DeleteEntityWithUid(collection string, uid primitive.ObjectID) {
	_, err := DB.Col(collection).DeleteOne(context.TODO(), bson.M{
		"_id": uid,
	})
	if err != nil {
		lgr.Error("%s", err.Error())
	}
}

func DeleteEntitiesOfParent(collection string, parent primitive.ObjectID) {
	_, err := DB.Col(collection).DeleteMany(context.TODO(), bson.M{
		"parent": parent,
	})
	if err != nil {
		lgr.Error("%s", err.Error())
	}
}

func DeleteEntities(collection string, query bson.M) error {
	_, err := DB.Col(collection).DeleteMany(context.TODO(), query)
	if err != nil {
		lgr.Error("%s", err.Error())
	}
	return err
}

func COU(col string, uid primitive.ObjectID, data interface{}) {
	if uid.IsZero() {
		InsertEntity(col, data)
	} else {
		UpdateEntity(col, bson.M{"$set": data})
	}
}

func Delete(col string, uid primitive.ObjectID) {
	DeleteEntity(col, bson.M{"_id": uid})
}

func UpdateEntity(collection string, entity any) {
	jData, _ := json.Marshal(entity)
	uid := gjson.Get(string(jData), "uid").String()

	_, err := DB.Col(collection).UpdateOne(context.TODO(), bson.M{"uid": uid}, bson.M{"$set": entity})

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
	}
}

func SetByOrgAndId(collection string, _id primitive.ObjectID, orgId primitive.ObjectID, update interface{}, opts ...*options.UpdateOptions) error {
	_, err := DB.Col(collection).UpdateOne(context.TODO(), bson.M{
		"_id": _id,
		"org": orgId,
	}, bson.M{
		"$set": update,
	}, opts...)

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
		return err
	}
	return nil
}

func SetById(collection string, _id primitive.ObjectID, update interface{}, opts ...*options.UpdateOptions) error {
	_, err := DB.Col(collection).UpdateOne(context.TODO(), bson.M{
		"_id": _id,
	}, bson.M{
		"$set": update,
	}, opts...)

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
		return err
	}
	return nil
}

func UpdateOneCustom(collection string, filter interface{}, update interface{}, opts ...*options.UpdateOptions) error {
	_, err := DB.Col(collection).UpdateOne(context.TODO(), filter, update, opts...)

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
		return err
	}
	return nil
}

func UpdateMany(collection string, filter bson.M, data bson.M) {
	_, err := DB.Col(collection).UpdateMany(context.TODO(), filter, data)

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
	}
}

func SetEntitiesWhere(collection string, filter bson.M, data any) {
	_, err := DB.Col(collection).UpdateMany(context.TODO(), filter, bson.M{"$set": data})

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
	}
}

func HasEntityWithUid(collection string, uid string) bool {
	value, _ := DB.Col(collection).CountDocuments(context.TODO(), bson.M{"uid": uid})
	return value > 0
}

func QueryEntitiesChannel[T any](ctx context.Context, collection string, query bson.M, opts ...*options.FindOptions) <-chan *T {
	resultsChan := make(chan *T)

	go func() {
		defer tools.Recover("Failed to do mongo thing")
		defer close(resultsChan) // Ensure the channel is closed when done

		cursor, err := DB.Col(collection).Find(ctx, query, opts...)

		if err != nil {
			lgr.ErrorStack("%s", err.Error())
			return // Exit if there's an error
		}
		defer cursor.Close(context.TODO()) // Ensure cursor is closed after iteration

		for cursor.Next(context.TODO()) {
			var elem T // Changed to T instead of *T
			if err := cursor.Decode(&elem); err != nil {
				lgr.Error("%s", err.Error())
				return // Exit if there's an error
			}
			resultsChan <- &elem // Send the address of elem to the channel
		}

		if err := cursor.Err(); err != nil {
			lgr.Error("%s", err.Error()) // Log any cursor errors
		}
	}()

	return resultsChan // Return the channel
}
func QueryEntitiesAsCopy[T any](collection string, query bson.M, opts ...*options.FindOptions) []T {
	cursor, err := DB.Col(collection).Find(context.TODO(), query, opts...)

	if err != nil {
		lgr.Error("%s", err.Error())
	}

	result := []T{}

	for cursor.Next(context.TODO()) {
		var elem T

		err := cursor.Decode(&elem)
		if err != nil {
			lgr.Error("%s", err.Error())
		}
		result = append(result, elem)
	}

	return result
}

func QueryEntities[T any](collection string, query bson.M, opts ...*options.FindOptions) []*T {

	cursor, err := DB.Col(collection).Find(context.TODO(), query, opts...)

	if err != nil {
		lgr.Error("%s", err.Error())
	}

	result := []*T{}

	for cursor.Next(context.TODO()) {
		var elem *T

		err := cursor.Decode(&elem)
		if err != nil {
			lgr.Error("%s", err.Error())
		}
		result = append(result, elem)
	}

	return result
}

func (self *AnyDBConnection) ListContainers() []string {

	names, err := self.Db(credentials.GetDBName()).ListCollectionNames(context.TODO(), bson.M{})

	if err != nil {
		lgr.Error("%s", err.Error())
		return make([]string, 0)
	}

	return names

}

func (self *AnyDBConnection) DeleteEntity(collection string, query bson.M) {
	self.Col(collection).DeleteOne(context.TODO(), query)
}

func NewAnyDBConnection() AnyDBConnection {
	// DefaultDocumentM: documents decoded into `any` (e.g. job results) become
	// maps instead of bson.D key/value lists, so they serialise to JSON objects.
	clientOptions := options.Client().ApplyURI(credentials.GetDBConnStr()).
		SetBSONOptions(&options.BSONOptions{DefaultDocumentM: true})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		lgr.Error("%s", err.Error())
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		lgr.Error("%s", err.Error())
	}

	lgr.Ok("Connected to MongoDB: %s", credentials.GetDBConnStr())
	lgr.Ok("Database name: %s", credentials.GetDBName())

	var conn = AnyDBConnection{}
	conn.SetIsCosmos(credentials.GetDBConnStr())
	conn.IsCosmos = false
	conn.Mongo = client

	return conn
}

func EntityExists(collection string, query bson.M) bool {
	var tmp bson.M
	err := DB.Col(collection).FindOne(context.TODO(), query).Decode(&tmp)

	if err != nil {
		return false
	}

	return true

}

func CountEntities(collection string, query bson.M) int64 {
	value, err := DB.Col(collection).CountDocuments(context.TODO(), query)

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
		return 0
	}

	return value
}
func (self *AnyDBConnection) SetIsCosmos(connStr string) {
	self.IsCosmos = strings.Contains(connStr, "mongo.cosmos.azure.com")
}

func (self *AnyDBConnection) SafeSort(cursor *mongo.Cursor, sort interface{}) ([]map[string]interface{}, error) {
	var results []map[string]interface{}

	// Check if the database is Cosmos DB or MongoDB, and apply logic accordingly
	if self.IsCosmos {
		// For Cosmos DB, assume no need to sort; just return the cursor as-is
		for cursor.Next(context.Background()) {
			var result map[string]interface{}
			if err := cursor.Decode(&result); err != nil {
				return nil, err
			}
			results = append(results, result)
		}
	} else {
		// For MongoDB, sorting is handled at the query level, so we iterate over the sorted cursor
		for cursor.Next(context.Background()) {
			var result map[string]interface{}
			if err := cursor.Decode(&result); err != nil {
				return nil, err
			}
			results = append(results, result)
		}
		// Check for any cursor errors after iteration
		if err := cursor.Err(); err != nil {
			return nil, err
		}
	}

	return results, nil
}

// EnsureIndex creates an index if missing (idempotent).
func EnsureIndex(collection string, keys bson.D, unique bool) {
	_, err := DB.Col(collection).Indexes().CreateOne(context.TODO(), mongo.IndexModel{
		Keys:    keys,
		Options: options.Index().SetUnique(unique),
	})

	if err != nil {
		lgr.Error("EnsureIndex %s: %s", collection, err.Error())
	}
}

// BulkUpsert executes upserts in one round trip. filters[i] / docs[i] pair up.
func BulkUpsert(collection string, filters []bson.M, docs []any) (int64, error) {
	if len(filters) == 0 {
		return 0, nil
	}

	models := make([]mongo.WriteModel, 0, len(filters))

	for i := range filters {
		models = append(models, mongo.NewUpdateOneModel().
			SetFilter(filters[i]).
			SetUpdate(bson.M{"$set": docs[i]}).
			SetUpsert(true))
	}

	result, err := DB.Col(collection).BulkWrite(context.TODO(), models, options.BulkWrite().SetOrdered(false))

	if err != nil {
		lgr.ErrorStack("%s", err.Error())
		return 0, err
	}

	return result.UpsertedCount + result.ModifiedCount, nil
}
