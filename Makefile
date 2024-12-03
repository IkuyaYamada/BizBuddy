.PHONY: backend frontend dev setup clean

# 開発サーバーの起動（両方同時に）
dev:
	@echo "Starting both servers..."
	@make backend & make frontend

# バックエンドの起動
backend:
	@echo "Starting backend server..."
	cd backend && \
	. .venv/bin/activate && \
	uvicorn app.main:app --reload --host 127.0.0.1 --log-level debug

# フロントエンドの起動
frontend:
	@echo "Starting frontend server..."
	cd frontend && \
	npm run dev

# 初期セットアップ
setup: setup-backend setup-frontend
	@echo "Setup completed!"

# バックエンドのセットアップ
setup-backend:
	@echo "Setting up backend..."
	cd backend && \
	python -m venv .venv && \
	. .venv/bin/activate && \
	pip install -r requirements.txt

# フロントエンドのセットアップ
setup-frontend:
	@echo "Setting up frontend..."
	cd frontend && \
	npm install

# クリーンアップ
clean:
	@echo "Cleaning up..."
	rm -rf backend/venv
	rm -rf frontend/node_modules
	find . -type d -name "__pycache__" -exec rm -r {} +
	find . -type f -name "*.pyc" -delete 
