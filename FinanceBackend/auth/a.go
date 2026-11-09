package auth

import (
	"net/http"
	"turtle/core/users"
	"turtle/credentials"

	"github.com/gin-gonic/gin"
)

// GetUserFromContext mirrors the Intelligence backend: without an auth
// provider every request runs as the local super admin (org = NilObjectID).
func GetUserFromContext(c *gin.Context) *users.User {
	return users.NewSuperAdmin()
}

func LoginRequired(c *gin.Context) {
	if credentials.AuthProvider() == credentials.AUTH_PROVIDER_NONE {
		c.Next()
		return
	}

	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"why": "Unauthorized"})
}

func AdminRequired(c *gin.Context) {
	c.Next()
}
