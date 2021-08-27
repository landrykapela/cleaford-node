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
//static files
app.use("/static",express.static("data"));
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
  let data = {tin:req.body.tin,code:req.body.imdg_code,country:req.body.country,region:req.body.region,user:req.body.user,name:req.body.company_name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,logo:req.body.logo,db:req.body.db};
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
  let data = {tin:req.body.tin,code:req.body.code,country:req.body.country,region:req.body.region,user:req.body.user,id:req.body.id,name:req.body.company_name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,logo:req.body.logo};
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
  let data = req.body;//{tin:req.body.tin,region:req.body.region,user:req.body.user,name:req.body.company_name,address:req.body.address,email:req.body.email,phone:req.body.phone,contact_person:req.body.contact_person,contact_email:req.body.contact_email,country:req.body.country,db:req.body.db}; 
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
  let data = req.body;
  data.id = customer_id;
  // console.log("d: ",data);
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
  });

  //packages
  app.post("/packages",authenticateToken,(req,res)=>{
    var package = {name:req.body.name,description:req.body.description,price:req.body.price,billing_term:req.body.billing_term,features:req.body.features}
    db.createPackage(package).then(result=>{
      res.status(201).json(result)
    })
    .catch(err=>{
      res.status(200).json(err);
    })
  })

  //get packages
  app.get("/packages",authenticateToken,(req,res)=>{
    db.getSubscriptionPackages()
    .then(result=>{
      res.status(200).json(result);
    })
    .catch(er=>{
      res.status(200).json(er);
    })
  })

  //consignments
  app.post("/consignments",authenticateToken,(req,res)=>{
    var  data = {
      cargo_classification:req.body.cargo_classification,
      place_of_destination:req.body.place_of_destination,
      place_of_delivery:req.body.place_of_delivery,
      port_of_discharge:req.body.port_of_discharge,
      port_of_origin:req.body.port_of_origin,
      no_of_containers:req.body.no_of_containers,
      goods_description:req.body.goods_description,
      no_of_packages:req.body.no_of_packages,
      package_unit:req.body.package_unit,
      gross_weight:req.body.gross_weight,
      gross_weight_unit:req.body.gross_weight_unit,
      gross_volume:req.body.gross_volume,gross_volume_unit:req.body.gross_volume_unit,net_weight:req.body.net_weight,net_weight_unit:req.body.net_weight_unit,
      invoice_value:req.body.invoice_value,invoice_currency:req.body.invoice_currency,freight_charge:req.body.freight_charge,freight_currency:req.body.freight_currency,
      imdg_code:req.body.imdg_code,packing_type:req.body.packing_type,oil_type:req.body.oil_type,shipping_mark:req.body.shipping_mark,
      user:req.body.user,consignee_name:req.body.consignee_address,consignee_phone:req.body.consignee_phone,consignee_tin:req.body.consignee_tin,consignee_address:req.body.consignee_address,
      notify_name:req.body.notify_name,notify_phone:req.body.notify_phone,notify_tin:req.body.notify_tin,notify_address:req.body.notify_address,
      forwarder_code:req.body.forwarder_code,forwarder_id:req.body.forwarder_id,exporter_id:req.body.exporter_id,
      instructions_file:req.body.instructions_file
  }
    db.createConsignment(data)
    .then(result=>{
      res.status(201).json(result);
    })
    .catch(er=>{
      res.status(200).json(er);
    });
  })
  app.get("/consignments/:user_id",authenticateToken,(req,res)=>{
    db.getConsignments(req.params.user_id)
    .then(result=>{
      res.status(200).json(result)
    })
    .catch(err=>{
      res.status(200).json(err);
    })
  })
 //update consignments
 app.put("/consignments/:user_id/:consignment_id",authenticateToken,(req,res)=>{
   var data = {
        cargo_classification:req.body.cargo_classification,
        place_of_destination:req.body.place_of_destination,
        place_of_delivery:req.body.place_of_delivery,
        port_of_discharge:req.body.port_of_discharge,
        port_of_origin:req.body.port_of_origin,
        no_of_containers:req.body.no_of_containers,
        goods_description:req.body.goods_description,
        no_of_packages:req.body.no_of_packages,
        package_unit:req.body.package_unit,
        gross_weight:req.body.gross_weight,
        gross_weight_unit:req.body.gross_weight_unit,
        gross_volume:req.body.gross_volume,gross_volume_unit:req.body.gross_volume_unit,net_weight:req.body.net_weight,net_weight_unit:req.body.net_weight_unit,
        invoice_value:req.body.invoice_value,invoice_currency:req.body.invoice_currency,freight_charge:req.body.freight_charge,freight_currency:req.body.freight_currency,
        imdg_code:req.body.imdg_code,packing_type:req.body.packing_type,oil_type:req.body.oil_type,shipping_mark:req.body.shipping_mark,
        user:req.params.user_id,
        id:req.params.consignment_id,
        consignee_name:req.body.consignee_name,
        consignee_phone:req.body.consignee_phone,
        consignee_address:req.body.consignee_address,
        consignee_tin:req.body.consignee_tin,
        notify_name:req.body.notify_name,
        notify_phone:req.body.notify_phone,
        notify_address:req.body.notify_address,
        notify_tin:req.body.notify_tin,
        exporter_id:req.body.exporter_id,
        forwarder_id:req.body.forwarder_id,
        forwarder_code:req.body.forwarder_code,
        instructions_file:req.body.instructions_file
    }
    if(!Object.values(data).includes(null) && data.status < 2) data.status = 2;

 
  db.updateConsignment(data)
  .then(result=>{
    res.status(201).json(result);
  })
  .catch(er=>{
    res.status(200).json(er);
  });
})
//updload consignment fiels
app.post("/uploads",authenticateToken,(req,res)=>{
  var data = {name:req.body.name,cid:req.body.cid,file:req.body.file,target:req.body.target,user:req.body.user};
  db.updateConsignmentFile(data).then(result=>{
    res.status(201).json(result);
  })
  .catch(er=>{
    res.status(200).json(er);
  })
})
//delete uploaded files
app.delete("/uploads/:user_id/:file_id",authenticateToken,(req,res)=>{
  let data = {userId:req.params.user_id,fileId:req.params.file_id};
  db.deleteFile(data).then(result=>res.status(200).json(result))
  .catch(e=>res.status(200).json(e))
})
//ship booking
app.post("/booking/:userId",authenticateToken,(req,res)=>{
  var data = {eta:req.body.eta,etb:req.body.etb,etd:req.body.etd,user_id:req.params.userId,cid:req.body.cid,mbl_number:req.body.mbl_number,shipping_line:req.body.shipping_line,vessel_name:req.body.vessel_name,
    booking_no:req.body.booking_no,bl_type:req.body.bl_type,
    terminal_carry_date:req.body.terminal_carry_date,booking_confirmation:req.body.booking_confirmation
  }
  db.createBooking(data).then(result=>{
    res.status(201).json(result);
  })
  .catch(e=>{
    res.status(200).json(e);
  })
})

//update booking
app.put("/booking/:userId",(req,res)=>{
  var data = {eta:req.body.eta,etb:req.body.etb,etd:req.body.etd,id:req.body.id,user_id:req.params.userId,cid:req.body.cid,mbl_number:req.body.mbl_number,shipping_line:req.body.shipping_line,vessel_name:req.body.vessel_name,
    booking_no:req.body.booking_no,bl_type:req.body.bl_type,
    terminal_carry_date:req.body.terminal_carry_date,booking_confirmation:req.body.booking_confirmation
  }
  db.updateBooking(data).then(result=>{
    res.status(201).json(result);
  })
  .catch(e=>{
    res.status(200).json(e);
  })
})
app.get("/booking/:userId",authenticateToken,(req,res)=>{
  db.getBookings(req.params.userId)
  .then(result=>{
    res.status(200).json(result)
  })
  .catch(er=>{
    res.status(200).json(er);
  })
})

//create containr booking
app.post("/container/:userId",authenticateToken,(req,res)=>{
  var data = req.body;
  if(data.no_of_packages == "") data.no_of_packages = 0;
  db.createContainer(parseInt(req.params.userId),data).then(result=>{
    res.status(201).json(result);
  })
  .catch(er=>{
    res.status(200).json(er);
  })
  // res.status(200).json(items);
})
//create containr booking
app.put("/container/:userId/:containerId",authenticateToken,(req,res)=>{
  var data = {
    user:req.params.userId,
    id:req.params.containerId,
    mbl_number : req.body.mbl_number,
    cid:req.body.cid,
    container_type : req.body.container_type,
    container_no : req.body.container_no,
    container_size : req.body.container_size,
    seal_1 : req.body.seal_1,
    seal_2 : req.body.seal_2,
    seal_3 : req.body.seal_3,
    freight_indicator : req.body.freight_indicator,
    no_of_packages : req.body.no_of_packages,
    package_unit : req.body.package_unit,
    volume : req.body.volume,
    volume_unit : req.body.volume_unit,
    weight : req.body.weight,
    weight_unit : req.body.weight_unit,
    max_temp : req.body.max_temp,
    min_temp : req.body.min_temp,
    plug_yn : req.body.plug_yn,
    container_file:req.body.container_file
  };
  db.updateContainer(data).then(result=>{
    res.status(201).json(result);
  })
  .catch(er=>{
    res.status(200).json(er);
  })
})

//quotations
app.post("/quotations/:userId",authenticateToken,(req,res)=>{
  var data = req.body;
  db.createQuotation(req.params.userId,data)
  .then(result=>{
    res.status(201).json(result);
  })
  .catch(e=>{
    res.status(200).json(e);
  })
  
})

//update quotations
app.put("/quotations/:userId",authenticateToken,(req,res)=>{
  var data = req.body;
  db.updateQuotation(req.params.userId,data)
  .then(result=>{
    res.status(201).json(result);
  })
  .catch(e=>{
    res.status(200).json(e);
  })
  
})
//get quotation
app.get("/quotations/:userId",authenticateToken,(req,res)=>{
  db.getQuotations(req.params.userId).then(result=>{
    res.status(200).json(result);
  }).catch(er=>{
    res.status(200).json(er);
  })
})
  //getpaymetn terms
  app.get("/payments",authenticateToken,(req,res)=>{
    db.getPaymentTerms().then(result=>{
      res.status(200).json(result);
    })
    .catch(err=>{
      res.status(200).json(err);
    })
  })
  //get list of regions
  app.get("/utils/regions",(req,res)=>{
    // res.json(postcodes.getCityNames());
    db.getConsignmentFiles(1,5).then(result=>{
      res.status(200).json(result);
    })
    .catch(e=>{
      console.log("test: ",e);
      res.status(200).json(e);
    })
  })

 
module.exports = app;
