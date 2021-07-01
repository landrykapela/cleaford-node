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
  
  if(token == null) return res.sendStatus(401);
  else{
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,cred)=>{
          if(err) return res.sendStatus(403);
          else{
              req.email = cred.email;
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

//create client record
app.post("/client",authenticateToken,(req,res)=>{
  let data = {name:req.body.company_name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,logo:req.body.logo};
  if(req.body.user == 0){
    let randomPass = db.generateRandomPassword(8);
    console.log("random: ",randomPass);
    let cred = {email:data.email};
    let token = jwt.sign(cred,process.env.REFRESH_TOKEN_SECRET);
    cred.token = token;
    cred.password = randomPass;
    db.signUp(cred).then(response=>{
      db.createClientSpace(cred.email).then(response=>{
        db.createClient(data)
        .then(result=>{
          if(result.code == 0){
            db.getClientList().then(response=>{
              res.status(201).json(response);
            })
          }
          else{
            res.status(200).json(result);
          }
        }).catch(e=>{
          res.status(200).json(e);
        })
      }).catch(e=>{
        res.status(200).json(e);
      })
      
    }).catch(e=>{
      res.status(200).json(e);
    })
  }
  else{
    db.createClient(data).then(response=>{
      res.status(200).json(response);
    }).catch(e=>{
      res.status(200).json(e);
    })
  }
})

//update client record
app.put("/client",authenticateToken,(req,res)=>{
  let data = {id:req.body.id,name:req.body.company_name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,logo:req.body.logo};
  db.updateClient(data)
  .then(result=>{
    if(req.body.user ==0){
      db.getClientList().then(clients=>{
        result.data = clients;
        console.log("result: ",result);
        res.status(201).json(result);
      }).catch(err=>{
        res.status(201).json(result);
      })
    }
    else{
      db.getClient(id)
    .then(client=>{
      result.data = client;
      res.status(201).json(result);
    })
    .catch(err=>{
      res.status(500).json(err);
    })
  }
    
  })
  .catch(err=>{
    res.status(500).json(err);
  })
})
//getclients
app.get("/clients",authenticateToken,(req,res)=>{
  db.getClientList()
  .then(result=>{
   res.status(200).json(result);
   
  })
  .catch(err=>{
    res.status(200).json(err);
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

  //roles
  app.get("/roles",authenticateToken,(req,res)=>{
    db.getRoles().then(result=>res.status(200).json(result)).catch(err=>{
      res.status(200).json(err)
    })
  });
  app.post("/role",authenticateToken,(req,res)=>{
    db.createRole({name:req.body.name,permission:req.body.permission})
    .then(result=>res.status(201).json(result))
    .catch(err=>res.status(200).json(err));
  })
module.exports = app;
