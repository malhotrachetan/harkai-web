.PHONY: setup install-fish install-poetry poetry-install

tunnel:
	ssh -i ~/.ssh/id_rsa azureuser@20.120.218.168

sync:
	rsync -i ~/.ssh/id_rsa -razP --exclude=frontend/node_modules --exclude=frontend/.cache --exclude=frontend/public --exclude=.git /Users/chetanmalhotra/Documents/Code/harkai/harkai-web azureuser@20.120.218.168:/home


setup: set-permissions install-fish install-poetry poetry-install 

set-permissions:
	@echo "Setting permissions and ownership for /home..."
	@if [ -d "/home" ]; then \
		sudo chmod a+w /home || { echo "Failed to set permissions on /home"; exit 1; }; \
		sudo chown azureuser:azureuser /home || { echo "Failed to set ownership on /home"; exit 1; }; \
		echo "Successfully set permissions and ownership on /home"; \
	else \
		echo "Error: /home directory not found"; \
		exit 1; \
	fi

# Install Fish shell and set as default
install-fish:
	@echo "Installing Fish shell..."
	@if ! command -v fish >/dev/null 2>&1; then \
		if command -v apt-get >/dev/null 2>&1; then \
			sudo apt-add-repository ppa:fish-shell/release-3 && \
			sudo apt-get update && \
			sudo apt-get install -y fish; \
		elif command -v brew >/dev/null 2>&1; then \
			brew install fish; \
		else \
			echo "Error: Neither apt-get nor brew found. Please install Fish manually."; \
			exit 1; \
		fi; \
	else \
		echo "Fish is already installed."; \
	fi
	@echo "Setting Fish as default shell..."
	@FISH_PATH=$$(which fish) && \
	if ! grep -q "$$FISH_PATH" /etc/shells; then \
		echo "$$FISH_PATH" | sudo tee -a /etc/shells; \
	fi && \
	sudo chsh -s "$$FISH_PATH" $$USER

# Install Poetry and add to PATH
install-poetry:
	@echo "Installing Poetry..."
	@if ! command -v poetry >/dev/null 2>&1; then \
		curl -sSL https://install.python-poetry.org | python3 -; \
	else \
		echo "Poetry is already installed."; \
	fi
	@echo "Configuring Poetry in shell configs..."
	@mkdir -p ~/.config/fish
	@echo 'set -gx PATH $$HOME/.local/bin $$PATH' >> ~/.config/fish/config.fish
	@echo 'export PATH="$$HOME/.local/bin:$$PATH"' >> ~/.bashrc
	@export PATH="/root/.local/bin:$PATH"
	@echo "Poetry installation complete. Please restart your shell or source your config files."

# Run poetry install
poetry-install:
	@echo "Running poetry install..."
	@poetry install
