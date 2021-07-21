const express = require("express");
const postcodes = require('postcodes-tz');
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
app.use(express.json({limit:'50mb'}))
// app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false,limit:'50mb' }));
// app.use(bodyParser({limit:'50mb'}));
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
  db.createClientSpace(req.body.user_id).then(result=>{
    res.status(200).json(result);
  })
  .catch(e=>{
    res.status(200).json(e);
  })
})

//create client record
app.post("/client",authenticateToken,(req,res)=>{
  let data = {country:req.body.country,region:req.body.region,user:req.body.user,name:req.body.company_name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,logo:req.body.logo,db:req.body.db};
  if(req.body.user == 0){
    let randomPass = "password";//db.generateRandomPassword(8);
    let cred = {email:data.contact_email};
    let token = jwt.sign(cred,process.env.REFRESH_TOKEN_SECRET);
    cred.token = token;
    cred.password = randomPass;
    db.signUp(data.contact_email,randomPass,token).then(response=>{
      db.createClientSpace(response.data.id).then(response=>{
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
    if(data.db){
      db.createClient(data).then(result=>{
        if(result.code == 0){
          db.getClient(data.contact_email).then(response=>{
            res.status(201).json(response);
          })
        }
        else{
          res.status(200).json(result);
        }
      }).catch(e=>{
        res.status(200).json(e);
      })
    }
    else{
      db.createClientSpace(data.user).then(response=>{
        db.createClient(data)
        .then(result=>{
          if(result.code == 0){
            db.getClient(data.contact_email).then(response=>{
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
    }
  }
})

//update client record
app.put("/client",authenticateToken,(req,res)=>{
  let data = {country:req.body.country,region:req.body.region,user:req.body.user,id:req.body.id,name:req.body.company_name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,logo:req.body.logo};
  db.updateClient(data)
  .then(result=>{
      res.status(201).json(result)
    })
    .catch(err=>{
      res.status(200).json(err);
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

//create customer
app.post("/customer",authenticateToken,(req,res)=>{
  let data = {region:req.body.region,user:req.body.user,name:req.body.company_name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,country:req.body.country,db:req.body.db}; 
  db.createCustomer(data)
  .then(result=>{
    res.status(201).json(result);
  })
  .catch(e=>{
    res.status(200).json(e);
  })
})
//update customer
app.put("/customer/:customer_id",authenticateToken,(req,res)=>{
  let customer_id = req.params.customer_id;
  let data = {id:customer_id,region:req.body.region,user:req.body.user,name:req.body.name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,country:req.body.country}; 
  db.updateCustomer(data)
    .then(result=>{
      res.status(201).json(result);
    })
    .catch(e=>{
      res.status(200).json(e);
    })  
})
//get customers
app.get("/customers/:userid",authenticateToken,(req,res)=>{
  let userid = req.params.userid;
  db.getCustomersList(userid)
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
app.get("/customers/:user_id", (req, res) => {
  db.getCustomersList(req.params.user_id)
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

//update user image
  app.put("/user/image/:userid", (req, res) => {
    let uid = req.params.userid;
    let image = req.body.image_file;
    db.updateUserImage(uid,image)
    .then(result=>{
      res.status(200).json(result);
    })
    .catch(e=>{
      res.json(e);
    })
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
 
  //roles
  app.get("/roles",authenticateToken,(req,res)=>{
    db.getRoles()
    .then(result=>res.status(200).json(result))
    .catch(err=>{
      res.status(200).json(err)
    })
  });
  //create role
  app.post("/role",authenticateToken,(req,res)=>{
    db.createRole({name:req.body.name,description:req.body.description,permission:req.body.permission})
    .then(result=>res.status(201).json(result))
    .catch(err=>res.status(200).json(err));
  })
  //update role
  app.put("/role/:roleId",authenticateToken,(req,res)=>{
    let role = {id:req.params.roleId,name:req.body.name,description:req.body.description}
    db.updateRole(role)
    .then(result=>res.status(201).json(result))
    .catch(err=>res.status(200).json(err));
  })
  //delete role
  app.delete("/role/:roleId",authenticateToken,(req,res)=>{
    db.deleteRole(req.params.roleId)
    .then(result=>{
      res.status(201).json(result);
    }).catch(err=>{
      res.status(200).json(err);
    })
  })
  //client roles
  app.get("/client_roles/:user_id",authenticateToken,(req,res)=>{
    db.getClientRoles(req.params.user_id)
    .then(result=>res.status(200).json(result))
    .catch(err=>{
      res.status(200).json(err);
    })
    })
 
  app.post("/client_roles/:user_id",authenticateToken,(req,res)=>{
    let data = {user_id:req.params.user_id,name:req.body.name,description:req.body.description,level:req.body.level}
    db.createClientRole(data)
    .then(result=>res.status(200).json(result)).catch(err=>{
      res.status(200).json(err);
    })
  })

  app.put("/client_roles/:user_id/:role_id",authenticateToken,(req,res)=>{
    let role_id = req.params.role_id;
    let user_id = req.params.user_id; 
    let data = {user:user_id,id:role_id,name:req.body.name,description:req.body.description,level:req.body.level};
    db.updateClientRole(data)
    .then(result=>res.status(200).json(result))
    .catch(err=>{
      res.status(200).json(err);
    })
  })
  app.delete("/client_roles/:user_id/:role_id",authenticateToken,(req,res)=>{
    let role_id = req.params.role_id;
    let user_id = req.params.user_id; 
    db.deleteClientRole(user_id,role_id)
    .then(result=>res.status(200).json(result))
    .catch(err=>{
      res.status(200).json(err);
    })
  })

  //get features
  app.get("/features",authenticateToken,(req,res)=>{
    db.getFeatures().then(result=>{
      res.status(200).json(result);
    })
    .catch(err=>{
      res.status(200).json(err);
    })
  })
  //get features multiple
  app.post("/features/multiple",authenticateToken,(req,res)=>{
    let ids = req.body.ids;
    db.getFeaturesMultiple(ids).then(result=>{
      res.status(200).json(result);
    })
    .catch(er=>{
      res.status(200).json(er);
    })
  })
  //create feature
  app.post("/features",authenticateToken,(req,res)=>{
    let data = {name:req.body.name,description:req.body.description,label:req.body.label,parent:req.body.parent};
    db.createFeature(data).then(result=>{
      res.status(200).json(result)
    }).catch(er=>{
      res.status(200).json(er);
    })
  })

  //update feature
  app.put("/features/:feature_id",authenticateToken,(req,res)=>{
    let data = {id:req.params.feature_id,name:req.body.name,description:req.body.description,label:req.body.label};
    db.updateFeature(data).then(result=>{
      res.status(201).json(result);
    }).catch(er=>{
      res.status(200).json(er);
    })
  })

  //delete feature
  app.delete("/features/:feature_id",authenticateToken,(req,res)=>{
    db.deleteFeature(req.params.feature_id).then(result=>{
      res.status(200).json(result)
    })
    .catch(e=>{
      res.status(200).json(e);
    })
  })
  //get list of regions
  app.get("/utils/regions",(req,res)=>{
    res.json(postcodes.getCityNames());
  })
module.exports = app;
