from flask import Flask
from flask_apscheduler import APScheduler
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from werkzeug.security import generate_password_hash, check_password_hash
import os, requests, uuid
from datetime import datetime, timedelta

def add_days(value, days):
    return value + timedelta(days=days)

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)

    app.config['SECRET_KEY'] = 'secret-key'
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') #'sqlite:///IPL.sqlite'

    app.jinja_env.filters['add_days'] = add_days

    db.init_app(app)
    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    from .models import User
    #
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(user_id)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint)

    from .api import api as api_blueprint
    app.register_blueprint(api_blueprint)

    from . import models
    from .main import refresh_qualification
    scheduler = APScheduler()
    scheduler.init_app(app)
    scheduler.start()

    @scheduler.task('interval', id='ping_task', seconds=600, misfire_grace_time=120)
    def ping():
        try:
            # Replace with your app's URL
            response = requests.get('https://tataipl2026.onrender.com/login')
            print(f"Ping successful, status code: {response.status_code}")
        except Exception as e:
            print(f"Error pinging app: {e}")

    with app.app_context():
        db.create_all()
    
    @scheduler.task('interval', id='qualification_task', hours=1, misfire_grace_time=120)
    def update_qualification():
        with app.app_context():
            try:
                refresh_qualification()
                print("Qualification percentages updated.")
            except Exception as e:
                print(f"Error updating qualifications: {e}")

    return app