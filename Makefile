# Turtle Finance monorepo helpers
.PHONY: backend frontend install build test

backend:            ## run Go API on :8095 (MongoDB on localhost:27017)
	cd FinanceBackend && go run .

frontend:           ## run Vite dev server on :3010 (proxies /api -> :8095)
	cd FinanceFrontend && bun run dev

install:
	cd FinanceFrontend && bun install
	cd FinanceBackend && go mod download

test:
	cd FinanceBackend && go vet ./... && go test ./finance/...

build:              ## single binary serving the built UI from ./static
	cd FinanceFrontend && bun run build
	rm -rf FinanceBackend/static && cp -R FinanceFrontend/build FinanceBackend/static
	cd FinanceBackend && go build -o finance-server .
