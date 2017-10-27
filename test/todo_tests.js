// Utility modules

let _ = require('lodash');


// Chai config

let chai = require('chai');
let chaiHTTP = require('chai-http');
let server = require('../app');
let expect = chai.expect;

chai.use(chaiHTTP);


// Database setup

let mongodb = require('mongodb');
let ObjectID = mongodb.ObjectID;

//let config = require('config');


// On your own computer, if can set environment variables
// Set the environment variable MONGO_URL to the correct URL
// If you can't set environment variables on your system, replace
// process.env.MONGO_URL with the actual URL string
let test_db_url = process.env.MONGO_URL;  // TODO replace this with a test database, not a test collection


// Tests!

describe('open and empty test db before and close db after ', () => {
  
  let tasks;
  let db;
  
  beforeEach('get task collection and delete all docs', function (done) {
    
    mongodb.connect(test_db_url)
      .then((task_db) => {
        
        db = task_db;
        tasks = db.collection('tasks');
        
        tasks.deleteMany({}).then(() => {
            return done();
          }
        )
        
      })
    
  });
  
  afterEach('close DB connection', (done) => {
    db.close(true)
      .then(() => { return done() })
  });
  
  
  describe("task tests with empty database", function() {
    
    it('Should show a "No task" message on home page when db is empty', function(done) {
      chai.request(server)
        .get('/')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.text).to.include("No tasks to do!");
          done();
        });
    });
    
    
    it('No tasks completed message when db is empty', function(done) {
      chai.request(server)
        .get('/completed')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.text).to.include("No tasks have been completed");
          done();
        });
    });
    
    
    it('should return 404 on GET to task/ID if id is not found', (done) => {
      
      /// todo 3 separate tests
      chai.request(server)
        .get('/task/')
        .end((err, res) => {
          expect(res.status).to.equal(404);
          
          chai.request(server)
            .get('/task/1234567')
            .end((err, res) => {
              expect(res.status).to.equal(404);
              
              chai.request(server)
                .get('/task/59e0ed7d4140789006aa5fae')  // A valid _id but not in the database.
                .end((err, res) => {
                  expect(res.status).to.equal(404);
                  done();
                });
            });
        });
      
    });
    
    
    // TODO add task
    
    it('should add a new task to the database on POST to /add', (done) => {
  
      chai.request(server)
        .post('/add')
        .send( { text: 'water plants' } )
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.include('water plants');
      
          tasks.find().toArray().then( (docs) => {
            expect(docs.length).to.equal(1);
            var doc = docs[0];
            expect(doc).to.have.property('text').equal('water plants');
            expect(doc).to.have.property('completed').equal(false);
            return done();
          });
        });
    });
  
  
    it('should NOT add a new task to the database on POST to /add and display a flash error ', (done) => {
  
      chai.request(server)
        .post('/add')
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.include('No tasks to do!');
  
          tasks.find().count().then( (count) => {
            expect(count).to.equal(0);
            return done();
          });
        });
    });
  
    
  });  // End of describe('task tests with empty db')
  
  
  
  describe('task tests start with 3 example tasks', function(){
    
    let walk_dog;
    let oil_change;
    let assignment;
    
    beforeEach('add three example task documents', function (done) {
      
      tasks.insertMany([
        { text : "walk dog", completed : false},
        { text : "oil change", completed : false},
        { text : "assignment", completed : true}
      ])
        .then((result)=>{
          
          //console.log(result)
          walk_dog = result.ops[0];
          oil_change = result.ops[1];
          assignment = result.ops[2];
          
          return done();
          
        })
    });
    
    
    it('should show a list of tasks if tasks in db', (done) => {
      chai.request(server)
        .get('/')
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.include('walk dog');
          expect(res.text).to.include('oil change');
          expect(res.text).not.to.include('assignment');
          
          done();
        });
    });
    
    
    it('should show a list of completed tasks if tasks in db', (done) => {
      chai.request(server)
        .get('/completed')
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).not.to.include('walk dog');
          expect(res.text).not.to.include('oil change');
          expect(res.text).to.include('assignment');
          done();
        });
    });
    
    
    it('should show a not-complete task\'s details on GET to /task/ID, with a done button', (done) => {
      chai.request(server)
        .get('/task/' + walk_dog._id)
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.include('walk dog');
          expect(res.text).to.include('is not yet completed');
          //expect(res.text).to.include('Done');  // TODO include chai-html element finder module to find the  done button
          done();
        });
    });
    
    
    it('should show a completed tasks details on GET to /task/ID, and no done button', (done) => {
      
      chai.request(server)
        .get('/task/' + assignment._id)
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.include('assignment');
          expect(res.text).to.include('is completed');
          expect(res.text).not.to.include('Done');  // no done button // TODO include chai-html element finder module to find the  done button
          return done();
        });
    });
    
    
    it('should mark a task as done on POST to /done body._id', (done) => {
      chai.request(server)
        .post('/done')
        .send({'_id': walk_dog._id})
        .end((err, res) => {
          expect(res.status).to.equal(200);
          // should be redirected home
          expect(res.text).to.not.include('walk dog');
          
          // check the DB
          tasks.findOne({_id: ObjectID(walk_dog._id)}).then((doc) => {
            expect(doc.completed).to.be.true;
            
            chai.request(server)
              .get('/completed')
              .send({'_id': walk_dog._id})
              .end((err, res) => {
                expect(res.text).to.include('walk dog');
                return done();
              });
            
          });
        })
      
    });
    
    
    it('should return 404 on POST to /done if _id is missing', (done) => {
      chai.request(server)
        .post('/done')
        .end((err, res) => {
          expect(res.status).to.equal(404);
          // TODO check the DB is not modified
          done();
        })
    });
    
    
    it('should return 404 on POST to /done if _id is not a valid _id', (done) => {
      
      chai.request(server)
        .post('/done')
        .send({'_id': '345345354'})
        .end((err, res) => {
          expect(res.status).to.equal(404);
          // TODO check the DB is not modified
          done();
        })
      
    });
    
    
    it('should return 404 on POST to /done if _id is a valid _id not in database', (done) => {
      chai.request(server)
        .post('/done')
        .send({'_id' : '1234567890abcdef1234567890'})
        .end((err, res) => {
          expect(res.status).to.equal(404);
          // TODO check the DB is not modified
          return done();
        });
    });
    
    
    it('should delete a task document with POST to delete with body._id', (done) => {
      chai.request(server)
        .post('/delete')
        .send({ '_id' : oil_change._id})
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.req.path).to.equal('/');
          expect(res.text).not.to.contain('oil change');
          tasks.findOne({_id : ObjectID(oil_change._id) } ).then((doc) => {
            expect(doc).to.be.null;
          }).then( () => {
            
            tasks.find().count().then( (count) => {
              expect(count).to.equal(2);
              done();
            })
            
          })
          
          
          
          
        })
    });
    
    
    it('should return 404 on POST to /delete a task document with invalid _id', (done) => {
      chai.request(server)
        .post('/delete')
        .send({ '_id' : 'qwerty'})   //invalid
        .end((err, res) => {
          expect(res.status).to.equal(404);
          tasks.find().count().then( (count) => {
            expect(count).to.equal(3);
            return done();
          })
        });
    });
    
    
    it('should return 404 on POST to /delete a task document with valid _id but not present in DB', (done) => {
      chai.request(server)
        .post('/delete')
        .send({ '_id' : '123456123456123456123456'})   //valid but doesn't exist
        .end((err, res) => {
          expect(res.status).to.equal(404);
          tasks.find().count().then( (count) => {
            expect(count).to.equal(3);
            return done();
          })
        });
    });
    
    
    it('should return 404 on POST to /delete a task document with no _id', (done) => {
      chai.request(server)
        .post('/delete')
        .end((err, res) => {
          expect(res.status).to.equal(404);
          tasks.find().count().then( (count) => {
            expect(count).to.equal(3);
            return done();
          })
          
        });
    });
    
    
    it('should mark all tasks as done on POST to /allDone', (done) => {
      
      chai.request(server)
        .post('/allDone')
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.include('No tasks to do!');
          tasks.find( { completed : true }).count().then( (count) => {
            expect(count).to.equal(3);
            return done();
          })
          
        });
    });
    
  });
  
  
  
});   // end of outer describe

