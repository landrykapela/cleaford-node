const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const db = require("./controllers/db");
const app = express();

//set CORS
app.use("/",(req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,PUT,PATCH,DELETE");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
  );
  next();
});
app.use(express.json())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.get("/", (req, res, next) => {
  console.log("Hello, Welcome to Cleaford App");

  res.status(200).json("Cleaford Running");
});

const authenticateToken=(req,res,next)=>{
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(" ")[1];
  console.log("token: ",token);
  if(token == null) return res.sendStatus(401);
  else{
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,user)=>{
          if(err) return res.sendStatus(403);
          else{
              req.user = user;
              next();
          }
      })
  }
}
//test db connection
app.get("/test-connection",authenticateToken,(req,res,next)=>{
    db.testDbConnection()
    .then(result=>{
        res.status(200).json({result});
    })
    .catch(error=>{
        res.status(200).json({error})
    })
})

//create client db
app.post("/initialize",authenticateToken,(req,res)=>{
  db.createClientSpace(req.body.email).then(result=>{
    console.log("testing...",result);
    res.status(200).json(result);
  })
  .catch(e=>{
    console.log("testing...",e);
    res.status(200).json(e);
  })
})


//get status
app.get("/status", (req, res) => {
  db.getStata()
    .then((stata) => {
      res.status(200).json({ stata });
    })
    .catch((error) => {
      res.status(200).json({ error });
    });
});

//get customers
app.get("/customers", (req, res) => {
  db.getCustomers()
    .then((customers) => {
      res.status(200).json({ customers });
    })
    .catch((error) => {
      res.status(200).json({ error });
    });
});

//add customer
app.post("/customer", (req, res) => {
  let body = req.body;
  
});

//update request
app.post("/customer/:customerId", (req, res) => {
  let customerId = req.params.customerId;
  let data = req.body;
  
});


//get supplier list
app.get("/suppliers", (req, res) => {
  db.getSuppliers()
    .then((suppliers) => {
      res.status(200).json({ suppliers });
    })
    .catch((error) => {
      res.status(200).json({ error });
    });
});
//udpate supplier
app.put("/supplier/:sid", (req, res) => {
  let sid = req.params.sid;
  let supplier = req.body;
  
});
//delete supplier
app.delete("/supplier/:sid", (req, res) => {
  let sid = req.params.sid;
 
});
//add supplier
app.post("/supplier", (req, res) => {
  let supplier = req.body;
  
});

//get single user
app.get("/user/:uid", (req, res) => {
  let userid = req.params.uid;
  
});
//add new user
app.post("/user", (req, result) => {
    let user = req.body;
    bcrypt.hash(user.password, 10).then((hash) => {
      user.password = hash;
      db.addUser(user)
        .then((res) => {
          result.status(201).json({ res:res });
        })
        .catch((error) => {
          result.status(200).json({ error:error });
        });
    });
  });
  //reset user password
  app.get("/reset_password/:email", (req, res) => {
    let email = req.params.email;
    // db.resetPassword(email)
    //   .then((response) => {
    //     res.status(201).json({ response });
    //   })
    //   .catch((error) => {
    //     res.status(200).json({ error });
    //   });
  });
  //get list of users
  app.get("/users", (req, res) => {
    db.getUsers()
      .then((users) => {
        res.status(200).json({ users });
      })
      .catch((error) => {
        res.status(200).json({ error });
      });
  });
  // delete user
  app.delete("/user/:userid", (req, res) => {
    let uid = req.params.userid;
  
    db.deleteUser(uid)
      .then((response) => {
        res.status(200).json({ response });
      })
      .catch((error) => {
        res.status(200).json({ error });
      });
  });
  app.patch("/user/restore/:userid",(req,res)=>{
   
   db.restoreUser(req.params.userid)
    .then(response=>{
      res.status(201).json({response})
    })
    .catch(error=>{
      es.status(200).json({error})
    })
    
   
  })
  app.patch("/user/:userid", (req, res) => {
    let uid = req.params.userid;
    let body = req.body;
  
    if (body.password !== undefined) {
      let password = body.password;
      bcrypt.hash(password, 10).then((hash) => {
        db.updatePassword(hash, uid)
          .then((response) => {
            delete body.password;
            body.id = uid;
            if (Object.keys(body).length > 1) {
              db.updateUser(body)
                .then((response) => {
                  res.status(201).json({ response });
                })
                .catch((error) => {
                  res.status(200).json({ error });
                });
            } else res.status(200).json({ response: response });
          })
          .catch((error) => {
            res.status(200).json({ error });
          });
      });
    } else {
      body.id = uid;
      if (Object.keys(body).length > 1) {
        db.updateUser(body)
          .then((response) => {
            res.status(201).json({ response });
          })
          .catch((error) => {
            res.status(200).json({ error });
          });
      } else {
        res.status(200).json({ response: "No update to make" });
      }
    }
  });
module.exports = app;
