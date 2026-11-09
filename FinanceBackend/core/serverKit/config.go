package serverKit

import (
	"encoding/json"
	"os"
	"turtle/core/lgr"
)

type GinServerConfig struct {
	Protocol    string `json:"protocol"`
	Host        string `json:"host"`
	Port        string `json:"port"`
	Mongo       string `json:"mongo"`
	MongoDbName string `json:"mongoDbName"`
}

var SERVER_CONFIG = &GinServerConfig{}

func LoadGinConfig() {
	// Read the JSON file
	data, err := os.ReadFile("./ginconfig.json")

	if err != nil {
		lgr.Error("Error reading ginconfig.json: %s", err.Error())
		return
	}

	// Parse JSON into struct
	var config GinServerConfig
	err = json.Unmarshal(data, &config)
	if err != nil {
		lgr.Error("Error parsing ginconfig.json: %v", err)
	} else {
		SERVER_CONFIG = &config
	}

}

// Helper method to get full server address
func (self *GinServerConfig) GetAddress() string {
	return self.Host + ":" + self.Port
}

// Helper method to get full URL
func (self *GinServerConfig) GetURL() string {

	return self.Protocol + "://" + self.Host + ":" + self.Port
}
