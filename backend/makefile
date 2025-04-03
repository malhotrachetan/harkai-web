celery-dev:
	poetry run celery -A harkaibackend worker --pool=solo  -l INFO --concurrency=2

celery:
	poetry run celery -A harkaibackend worker -l INFO --concurrency=2
	#--without-mingle --without-gossip --without-heartbeat

django:
	poetry run python3 manage.py runserver

daphne:
	poetry run daphne -p 8000 harkaibackend.asgi:application

gunicorn:
	poetry run gunicorn harkaibackend.wsgi gevent --workers 5 --bind 0.0.0.0:8000 -k sync --access-logfile - --error-logfile - --log-level info --timeout 300
#unix:/home/narrationbox/backend_run/gunicorn.sock 0.0.0.0:8000
migrations:
	poetry run python3 manage.py makemigrations

migrate:
	poetry run python3 manage.py migrate

celery-periodic:
	poetry run celery -A backend beat -l INFO

redis-dev-start:
	brew services start redis

redis-dev-stop:
	brew services stop redis

static:
	poetry run python3 manage.py collectstatic

secrets:
	poetry run python3 manage.py edit_secrets

