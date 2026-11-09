package prices

import (
	"turtle/finance/market"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PriceDoc is one stored daily bar of a company.
type PriceDoc struct {
	Org        primitive.ObjectID `json:"-" bson:"org"`
	CompanyUid primitive.ObjectID `json:"-" bson:"companyUid"`
	market.Bar `bson:",inline"`
}

type DividendDoc struct {
	Org             primitive.ObjectID `json:"-" bson:"org"`
	CompanyUid      primitive.ObjectID `json:"-" bson:"companyUid"`
	market.Dividend `bson:",inline"`
}

// Point is one observation of a (resampled) series.
type Point struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}

const (
	INTERVAL_DAY   = "D"
	INTERVAL_WEEK  = "W"
	INTERVAL_MONTH = "M"
)
