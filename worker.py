from IPL import create_app, db
from flask_apscheduler import APScheduler
from IPL.main import refresh_qualification, update_toppers
import requests
import os

# Set up app config from environment variables or defaults
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///IPL.sqlite')
SECRET_KEY = os.environ.get('SECRET_KEY', 'secret-key')

app = create_app()
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SECRET_KEY'] = SECRET_KEY

scheduler = APScheduler()
scheduler.init_app(app)

@scheduler.task('interval', id='ping_task', seconds=600, misfire_grace_time=120)
def ping():
    try:
        response = requests.get('https://tataipl2026.onrender.com/login', verify=False)
        print(f"Ping successful, status code: {response.status_code}")
    except Exception as e:
        print(f"Error pinging app: {e}")

@scheduler.task('interval', id='qualification_task', hours=1, misfire_grace_time=120)
def update_qualification():
    with app.app_context():
        try:
            refresh_qualification()
            print("Qualification percentages updated.")
        except Exception as e:
            print(f"Error updating qualifications: {e}")

@scheduler.task('interval', id='toppers_task', minutes=5, misfire_grace_time=120)
def update_toppers_task():
    with app.app_context():
        try:
            update_toppers()
            print("Toppers updated.")
        except Exception as e:
            print(f"Error updating toppers: {e}")

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    scheduler.start()
    import time
    while True:
        time.sleep(60)
