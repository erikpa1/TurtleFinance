package serverKit

import "net"

// isLocalhost checks if the given IP address is localhost
func IsLocalhost(ip string) bool {
	// Remove port if present
	host, _, err := net.SplitHostPort(ip)
	if err != nil {
		host = ip
	}

	// Check for localhost variations
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}

	// Check if it's an IPv6 localhost
	parsedIP := net.ParseIP(host)
	if parsedIP != nil && parsedIP.IsLoopback() {
		return true
	}

	return false
}
