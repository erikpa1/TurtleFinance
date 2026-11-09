package ai

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type OllamaModel struct {
	Name       string    `json:"name"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modifiedAt"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

var ollamaClient = &http.Client{Timeout: 6 * time.Minute}

func normalizeHost(host string) string {
	host = strings.TrimRight(strings.TrimSpace(host), "/")
	if host != "" && !strings.HasPrefix(host, "http") {
		host = "http://" + host
	}
	return host
}

// ListModels returns locally installed Ollama models.
func ListModels(host string) ([]OllamaModel, error) {
	client := &http.Client{Timeout: 4 * time.Second}

	resp, err := client.Get(normalizeHost(host) + "/api/tags")
	if err != nil {
		return nil, fmt.Errorf("ollama not reachable at %s (is `ollama serve` running?)", host)
	}
	defer resp.Body.Close()

	var payload struct {
		Models []struct {
			Name       string    `json:"name"`
			Size       int64     `json:"size"`
			ModifiedAt time.Time `json:"modified_at"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	result := []OllamaModel{}
	for _, m := range payload.Models {
		result = append(result, OllamaModel{Name: m.Name, Size: m.Size, ModifiedAt: m.ModifiedAt})
	}
	return result, nil
}

// Chat sends a non-streaming chat request. jsonMode forces a JSON answer.
func Chat(host string, model string, system string, user string, jsonMode bool) (string, error) {
	body := map[string]any{
		"model": model,
		"messages": []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		"stream": false,
		"options": map[string]any{
			"temperature": 0.2,
			"num_ctx":     8192,
		},
	}
	if jsonMode {
		body["format"] = "json"
	}

	data, _ := json.Marshal(body)
	resp, err := ollamaClient.Post(normalizeHost(host)+"/api/chat", "application/json", bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("ollama not reachable at %s (is `ollama serve` running?)", host)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		msg := strings.TrimSpace(string(raw))
		if strings.Contains(msg, "not found") {
			return "", fmt.Errorf("model %q is not installed – run `ollama pull %s`", model, model)
		}
		return "", fmt.Errorf("ollama HTTP %d: %s", resp.StatusCode, msg)
	}

	var payload struct {
		Message chatMessage `json:"message"`
		Error   string      `json:"error"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return "", err
	}
	if payload.Error != "" {
		return "", errors.New(payload.Error)
	}

	return stripThinking(payload.Message.Content), nil
}

// stripThinking removes <think>…</think> blocks emitted by reasoning models.
func stripThinking(s string) string {
	for {
		start := strings.Index(s, "<think>")
		if start < 0 {
			break
		}
		end := strings.Index(s[start:], "</think>")
		if end < 0 {
			s = s[:start]
			break
		}
		s = s[:start] + s[start+end+len("</think>"):]
	}
	return strings.TrimSpace(s)
}

// extractJson returns the first {...} object in s (models sometimes wrap JSON in prose).
func extractJson(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}
