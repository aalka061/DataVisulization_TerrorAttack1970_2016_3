
from flask import Flask
from flask import render_template
from pymongo import MongoClient
import json
from bson import json_util
from bson.json_util import dumps

app = Flask(__name__)    # Construct an instance of Flask class for our webapp

MONGODB_HOST = 'localhost'
MONGODB_PORT = 27017
DBS_NAME = 'terrorDatadb'
COLLECTION_NAME = 'projects'
FIELDS = {'iyear': True, 'imonth': True, 
          'region_txt': True, 'country_txt': True, 
          'attacktype1_txt': True,'targtype1_txt': True,
           'iday': True,
          'gname': True, '_id': False}


@app.route('/')   # URL '/' to be handled by main() route handler
def main():
    """Say hello"""
    return 'Hello, world!'


@app.route('/tuna')
def tuna():
    return render_template('index3.html')


@app.route('/data')
def data():
    connection = MongoClient(MONGODB_HOST, MONGODB_PORT)
    collection = connection[DBS_NAME][COLLECTION_NAME]
    projects = collection.find(projection=FIELDS)
    json_projects = []
    for project in projects:
        json_projects.append(project)
    json_projects = json.dumps(json_projects, default=json_util.default)
    connection.close()
    return json_projects


if __name__ == '__main__':
    app.run()

