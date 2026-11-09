package serverKit

import (
	"bytes"
	"fmt"
	"net/http"
	"turtle/core/files"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

const CONTENT_TYPE_OCTET = "application/octet-stream"
const CONTENT_TYPE_JSON = "application/json"
const CONTENT_TYPE_PDF = "application/pdf"

const CONTENT_TYPE_GZIP = "application/pdf"

const CONTENT_ENCODING_GZIP = "gzip"

func ReturnUnauthorized(c *gin.Context, err error) {
	c.String(http.StatusUnauthorized, err.Error())
}

func ReturnJsonOr404(c *gin.Context, jObj any) {
	if jObj == nil {
		c.JSON(http.StatusNotFound, bson.M{})
	} else {
		c.JSON(http.StatusOK, jObj)
	}

}

func ReturnOkJson(c *gin.Context, jObj any) {
	c.JSON(http.StatusOK, jObj)
}

func Return404(c *gin.Context, jObj any) {
	c.JSON(http.StatusNotFound, jObj)
}

func ReturnUnacceptable(c *gin.Context, err error) {
	c.String(http.StatusNotAcceptable, err.Error())
}
func Return500(c *gin.Context, err error) {
	c.String(http.StatusInternalServerError, err.Error())
}

func AutoZipFileOrErrorNotFound(c *gin.Context, data []byte, err error, contentType string) {
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{})
	} else {
		c.Header("Content-Encoding", CONTENT_ENCODING_GZIP)

		c.Data(http.StatusOK, contentType, data)
	}
}

func AutoFileJsonOrErrorNotFound(c *gin.Context, data []byte, err error) {
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{})
	} else {
		c.Data(http.StatusOK, "application/json", data)
	}
}
func AutoFileOrErrorNotFound(c *gin.Context, data []byte, err error) {
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{})
	} else {
		c.Data(http.StatusOK, "application/octet-stream", data)
	}
}

func AutoPdfOrErrorNotFound(c *gin.Context, fileName string, data []byte, err error) {
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{})
	} else {
		c.Header("Content-Type", CONTENT_TYPE_PDF)
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", fileName))

		c.Data(http.StatusOK, CONTENT_TYPE_PDF, data)
	}
}

func AutoImageOrErrorNotFound(c *gin.Context, fileName string, data []byte, err error) {
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{})
	} else {

		ext := files.ExtractExtensionNoDot(fileName)

		if ext == "svg" {
			c.Header("Content-Type", "image/svg+xml")
		} else {
			c.Header("Content-Type", "image/"+ext)
		}

		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", fileName))

		c.Data(http.StatusOK, CONTENT_TYPE_PDF, data)
	}
}

func AutoFileDownloadOrErrorNotFound(c *gin.Context, fileName string, data []byte, err error) {
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{})
	} else {
		reader := bytes.NewReader(data)
		// Set headers for file download
		c.Header("Content-Description", "File Transfer")
		c.Header("Content-Disposition", "attachment; filename="+fileName)
		c.Header("Content-Type", "application/octet-stream")
		c.Header("Content-Transfer-Encoding", "binary")
		c.Header("Expires", "0")
		c.Header("Cache-Control", "must-revalidate")
		c.Header("Pragma", "public")
		c.Header("Content-Length", fmt.Sprintf("%d", len(data)))
		c.DataFromReader(http.StatusOK, int64(len(data)), "application/octet-stream", reader, nil)
	}
}
