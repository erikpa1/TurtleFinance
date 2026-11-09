package users

import (
	"turtle/core/lgr"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserType int8

const (
	USER_TYPE_USER       = 0
	USER_TYPE_EDITOR     = 1
	USER_TYPE_ADMIN      = 2
	USER_TYPE_SUPERADMIN = 3
)

type User struct {
	Uid       primitive.ObjectID
	Email     string
	Firstname string
	Surname   string
	Password  string
	Type      int8
	Org       primitive.ObjectID
}

func NewUser() *User {
	tmp := User{}
	tmp.Firstname = ""
	tmp.Password = ""
	tmp.Surname = ""
	tmp.Type = USER_TYPE_USER
	return &tmp
}

func NewSuperAdmin() *User {
	tmp := User{}
	tmp.Firstname = "Poisedon"
	tmp.Password = ""
	tmp.Surname = "The Olympian"
	tmp.Type = USER_TYPE_SUPERADMIN
	return &tmp
}

func (self *User) FromAnotherUserNoPass(another *User) {
	self.Firstname = another.Firstname
	self.Surname = another.Surname
	self.Type = another.Type
	self.Uid = another.Uid
}

func (self *User) IsSuperAdmin() bool {
	return self.Type >= USER_TYPE_SUPERADMIN
}

func (self *User) IsAdmin() bool {
	return self.Type >= USER_TYPE_ADMIN
}

func (self *User) IsEditor() bool {
	return self.Type >= USER_TYPE_EDITOR
}

func (self *User) IsSimpleUser() bool {
	return self.Type == USER_TYPE_USER
}

func (self *User) IsAdminWithError() bool {
	if self.IsAdmin() {
		return true
	} else {
		lgr.Error(self.Uid.Hex(), "is only", self.Type)
		return false
	}
}

func (self *User) FillOrgQuery(query bson.M) bson.M {
	if query == nil {
		return bson.M{
			"org": self.Org,
		}
	} else {
		query["org"] = self.Org
	}

	return query
}
