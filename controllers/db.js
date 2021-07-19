const mysql = require("mysql");
const config = require("./config.json");
const bcrypt = require("bcrypt");
require("dotenv").config();
const fs = require('fs');
const { join } = require("path");


//mysql pool
const pool = mysql.createPool({
    socketPath: config.socket,
    host: config.host,
    user: config.user,
    database: config.db,
    password: config.secret,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

//generate random string
const randomString = (length)=>{
    let result = "";
    var charSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    for(let i=0; i<length;i++){
        result += charSet.charAt(Math.floor(Math.random()*charSet.length));
    }
    return result;
}

//gettime stamp
const getTimeStamp =()=>{
    return new Date(parseInt(Date.now()));
}

//save base64 to file
const saveImage = (encodedImage)=>{
    
    var matches = encodedImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
    response = {};
    
    if (matches.length !== 3) {
        return {code:1,msg:"Invalid image"}
    }
    
    response.type = matches[1];
    response.data = new Buffer(matches[2], 'base64');
    
    // var path "/var/"

    return response;
    
    
}

//update user imiage
exports.updateUserImage = (user_id,image)=>{
    return new Promise((resolve,reject)=>{
        let sql = "update user_tb set avatar = ? where id=?";
        pool.getConnection((e,con)=>{
            if(e){
                console.error("db.updateUserImage(): ",e);
                reject({code:1,msg:"Could not upload image",error:e});
            }
            else{
                con.query(sql,[image,user_id],(e,r)=>{
                    if(e){
                        console.error("db.updateUserImage(): ",e);
                        reject({code:1,msg:"Could not upload image",error:e});
                    }
                    else{
                        con.release();
                        this.getUser(user_id).then(result=>{
                            resolve({code:0,msg:"Successful",data:result.data});
                        }).catch(e=>{
                            resolve({code:0,msg:"Successful",data:null});
                        })
                        
                    }
                })
            }
        })
        
    })
   
}
//generate random Password
exports.generateRandomPassword = (length)=>{
    let result = "";
    var charSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@?*#%";
    for(let i=0; i<length;i++){
        result += charSet.charAt(Math.floor(Math.random()*charSet.length));
    }
    return result;
}
//test database connection
exports.testDbConnection = ()=>{
    return new Promise((resolve,reject)=>{
        pool.query("show tables",(error,rows,fields)=>{
            if(error) {
                console.error("testDbConnection(): ",error);
                reject("An error occured: "+error);
            }
            else{
                console.log("testDbConnection(): ","Successful");
                resolve("Successfully connected to cleaford database");
            }
        })
    })
}

//create client db
exports.createClientSpace = (userId)=>{

    return new Promise((resolve,reject)=>{
    var ref = randomString(8).toLowerCase();
    var password = this.generateRandomPassword(10);
    this.getUser(userId)
        .then(result=>{
            var user = result.data;
                pool.getConnection((err,connection)=>{
                    connection.beginTransaction((err)=>{
                        if(err){
                            connection.rollback(()=>{
                                connection.release();
                                console.error("createClientSpace(): ",err);
                                reject({code:1,msg:"Could not create client space",error:err});
                            })
                            
                        }
                        else{
                            connection.query("create database if not exists space_"+ref,(e,r,f)=>{
                                if(e){
                                    connection.rollback(()=>{
                                        connection.release();
                                        console.error("createClientSpace(): ",e);
                                        reject({code:1,msg:"failed to create client space",error:e});
                                    })
                                    
                                }
                                else{
                                    connection.query("create user '"+ref+"_admin'@'localhost' identified with mysql_native_password by '"+password+"'",(e,r,f)=>{
                                        if(e){
                                            connection.rollback(()=>{
                                                connection.release();
                                                console.error("createClientSpace(): ",e);
                                                reject({code:1,msg:"Failed to add user to client space",error:e});
                                            })
                                        }
                                        else{
                                            connection.query("GRANT ALL PRIVILEGES ON space_"+ref+".* TO '"+ref+"_admin'@'localhost'",(e,r)=>{
                                                if(e){
                                                    connection.rollback(()=>{
                                                        connection.release();
                                                        console.error("createClientDb(): ",e);
                                                        reject({code:1,msg:"Failed to add user to client space",error:e});
                                                    })
                                                }
                                                else{
                                                    connection.query("FLUSH PRIVILEGES",(e,r)=>{
                                                    
                                                            if(e){
                                                                connection.rollback(()=>{
                                                                    connection.release();
                                                                    console.error("createClientSpace(): ",e);
                                                                    reject({code:1,msg:"Failed to generate client space",error:e});
                                                                }) 
                                                            }
                                                            else{
                                                                connection.query("update user_tb set db=?,db_sec=? where email=?",["space_"+ref,password,user.email],(e,r)=>{
                                                                    if(e){
                                                                        connection.rollback(()=>{
                                                                            connection.release();
                                                                            console.error("db.createClientSpace(): ",e);
                                                                            reject({code:1,msg:"Failed to update user table",error:e});
                                                                        })
                                                                    }
                                                                    else{
                                                                        connection.commit((e)=>{
                                                                            if(e){
                                                                                connection.rollback(()=>{
                                                                                    connection.release();
                                                                                    console.error("db.createClientSpace(): ",e);
                                                                                    reject({code:1,msg:"Failed to update user table"});
                                                                                })
                                                                            }
                                                                            else{
                                                                                connection.release();
                                                                                resolve({code:0,msg:"successfully created client space"});
                                                                            }
                                                                        })
                                                                    }
                                                                })
                                                            }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                
                                }
                            })
                            
                        }
                    })
                    
                })          
        })
        .catch(e=>{
            console.error("db.createClientSpace(): ",e);
            reject({code:1,msg:"Could not create client space",error:e});
        })
    })
   
}

//get client pool
exports.getClientPool = (user)=>{
    let prefix = user.db.split("_")[1];
    return mysql.createPool({
        socketPath:config.socket,host:config.host,
        user: prefix+"_admin",
        database: user.db,
        password: user.db_sec,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    })
}

//create client
exports.createClient = (data)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((err,conn)=>{
            conn.beginTransaction((err)=>{
                if(err){
                    conn.rollback(()=>{
                        conn.release();
                        console.error("db.createClient(): ",err);
                        reject({code:1,msg:"Failed to create client"});
                    });
                }
                else{
                    // if(data.user === 0){
                    //     // this.signUp()
                    // }
                    var sql = "insert into client_tb (country,region,status,logo,name,address,email,phone,contact_person,contact_email,date_created) values (?) on duplicate key update status=values(status),logo=values(logo),name=values(name),address=values(address),phone=values(phone),contact_person=values(contact_person),country=values(country),region=values(region)";
                    let values = [data.country,data.region,1,data.logo,data.name,data.address,data.email,data.phone,data.contact_person,data.contact_email,Date.now()]
                    conn.query(sql,[values],(er,res)=>{
                        if(er){
                            conn.rollback(()=>{
                                conn.release();
                                console.error("db.createClient(): ",er);
                                reject({code:1,msg:"Failed to add client"});
                            });
                        }
                        else{
                            conn.commit((e)=>{
                                if(e){
                                    conn.rollback(()=>{
                                        conn.release();
                                        console.error("db.createClient(): ",err);
                                        reject({code:1,msg:"Failed to commit client"});
                                    });
                                }
                                else{
                                    conn.release();
                                    resolve({code:0,msg:"Successul"});
                                }
                            })
                        }
                    })
                }
            })
        });
 
    });
}
//update client
exports.updateClient=(data)=>{
    return new Promise((resolve,reject)=>{
        this.getClientById(data.id).then(rs=>{
            if(rs.code == 0){
                let login_email = rs.data.contact_email;
                if(login_email != data.contact_email){
                    pool.query("update user_tb set email=? where email=?",[data.contact_email,login_email],(e,r)=>{
                        if(e){
                            console.error("db.updateClient(): ",e);
                        }
                       
                    })
                }
                
                let sql = "update client_tb set country=?,region=?,phone=?,name=?,email=?,address=?,contact_person=?,contact_email=?,logo=? where id=?";
                let values = [data.country,data.region,data.phone,data.name,data.email,data.address,data.contact_person,data.contact_email,data.logo,data.id];
                pool.query(sql,values,(e,r)=>{
                    if(e){
                        console.error("db.updateClient(): ",e);
                        reject({code:1,msg:"Could not update client data"});
                    }
                    else{
                        if(data.user == 0){
                            this.getClientList().then(clients=>{
                                resolve({code:0,msg:"Successfully updated Client data",data:clients.data});
                            }).catch(e=>{
                                console.error("db.updateClient(): ",e);
                                reject(e);
                            })
                        }
                        else{
                            this.getClientById(data.id).then(client=>{
                                resolve({code:0,msg:"Successfully updated Client data",data:client.data});
                            })
                            
                        }
                        
                    }
                })
            
            }
        })
       
    })
}
//get list of clients
exports.getClientList =()=>{
    return new Promise((resolve,reject)=>{
        var sql = "select * from client_tb";
        pool.query(sql,(e,r,f)=>{
            if(e){
                console.error("db.getClientList(): ",e);
                reject({code:1,msg:"Failed to retrieve client list"});
            }
            else{
                resolve({code:0,msg:"Successful",data:r});
            }
        })
    })
}
//get single client record
exports.getClient = (email)=>{
    return new Promise((resolve,reject)=>{
        let sql = "select * from client_tb where email=? or contact_email=?";
        
        pool.query(sql,[email,email],(e,r,f)=>{
            if(e){
                console.error("db.getClientList(): ",e);
                reject({code:1,msg:"Failed to retrieve client"});
            }
            else{
                if(r && r.length > 0)
                resolve({code:0,msg:"Successful",data:r[0]});
                else reject({code:1,msg:"No client information for email: "+email})
            }
        })
    })
}
exports.getClientById = (clientId)=>{
    return new Promise((resolve,reject)=>{
        let sql = "select * from client_tb where id=?";
        
        pool.query(sql,[clientId],(e,r,f)=>{
            if(e){
                console.error("db.getClientList(): ",e);
                reject({code:1,msg:"Failed to retrieve client list"});
            }
            else{
                resolve({code:0,msg:"Successful",data:r[0]});
            }
        })
    }) 
}

//create customer record
exports.createCustomer=(data)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(data.user)
        .then(result=>{
            let user = result.data;
            let pool = this.getClientPool(user);
            pool.getConnection((er,conn)=>{
                if(er){
                    resolve({code:1,msg:"Something went wrong. Please try again later",error:er});
                }
                else{
                    conn.beginTransaction((e)=>{
                        if(e){
                            conn.release();
                            reject({code:1,msg:"Something went wrong. Please try again later",error:e});
                        }
                        else{
                            let sql = "create table if not exists customer_tb (id int(10) auto_increment primary key,name varchar(50) not null, email varchar(255) unique not null,address varchar(255),region varchar(50), country varchar(50),contact_person varchar(50),contact_email varchar(50),phone varchar(15) not null)";
                            conn.query(sql,(e,r)=>{
                                if(e){
                                    conn.rollback((e)=>{
                                        conn.release();
                                        console.error("db.createCustomer(): ",e);
                                        reject({code:1,msg:"Something went wrong. Please try again later",error:e});    
                                    });
                                }
                                else{
                                    conn.commit((e)=>{
                                        if(e){
                                            conn.release();
                                            console.error("db.createCustomer(): ",e);
                                            reject({code:1,msg:"Could not create customer",error:e});                                                  
                                        }
                                        else{

                                            let sql = "insert into customer_tb (name,address,region,country,email,phone,contact_email,contact_person) values(?) on duplicate key update region=values(region),contact_email=values(contact_email),country=values(country),address=values(address),phone=values(phone),contact_person=values(contact_person)";
                                            let values = [data.name,data.address,data.region,data.country,data.email,data.phone,data.contact_email,data.contact_person];
                                            conn.query(sql,[values],(e,r)=>{
                                                if(e){
                                                    conn.rollback(error=>{
                                                        if(error){
                                                            console.error("db.createCustomer(): ",error);
                                                            reject({code:1,msg:"Could not create customer",error:error});
                                                        
                                                        }
                                                        else{
                                                            console.error("db.createCustomer(): ",e);
                                                            reject({code:1,msg:"Could not create customer",error:e});
                                                        }
                                                    })
                                                }
                                                else{
                                                    conn.release();
                                                    this.getCustomersList(data.user).then(result=>{
                                                        resolve(result);
                                                    })
                                                    .catch(er=>{
                                                    reject(er);
                                                    })
                                                }
                                            })

                                        }
                                    })
                                    
                                }
                            })
                        }
                    })
                }
            })
                
        })
        .catch(e=>{
            console.error("db.createCustomer(): ",e);
            reject({code:1,msg:"User was not found.",error:e});

        })
        
    })
}
//update customer
exports.updateCustomer = (data)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(data.user)
        .then(result=>{
            let pool = this.getClientPool(result.data);
            let sql = "update customer_tb set name=?,address=?,country=?,region=?,email=?,phone=?,contact_person=?,contact_email=? where id=?";
            let values = [data.name,data.address,data.country,data.region,data.email,data.phone,data.contact_person,data.contact_email,data.id];
            pool.query(sql,values,(e,r)=>{
                if(e){
                    console.error("db.updateCustomer(): ",e);
                    reject({code:1,msg:"Could not update customer record",error:e});
                }
                else{
                    this.getCustomersList(data.user)
                    .then(result=>{
                        resolve(result);
                    })
                    .catch(err=>{
                        console.error("db.updateCustomer(): ",err);
                        reject(err);
                    })
                }
            })
        })
        .catch(err=>{
            console.error("db.updateCustomer(): ",err);
            reject(err);
        })
    })
}
//get customer list
exports.getCustomersList =(userId)=>{

    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            let user = result.data;
            if(user.db && user.db.includes("_")){
                var pool = this.getClientPool(user);
                let sql = "select * from customer_tb order by name asc";
                pool.query(sql,(e,r)=>{
                    if(e){
                        console.error("db.getCustomerList(): ",e);
                        reject({code:1,msg:"Could not retrieve the list of customers",error:e});
                    }
                    else{
                        resolve({code:0,msg:"Successful",data:r});
                    }
                });
            }
           else{
               this.createClientSpace(userId).then(result=>{
                   if(result.code == 0){
                       result.msg = "No customers registered";
                       result.data = [];
                       resolve(result);
                   }
                   else{
                       reject(result);
                   }
               }).catch(e=>{
                   console.error("db.getCustomersList(): ",e);
                   reject(e);
               })
           }
        })
        .catch(e=>{
            console.error("db.getCustomersList(): ",e);
            reject({code:1,msg:"Could not retrieve the list of customers",error:e})
        })
    })
}
//signout
exports.signout =(email)=>{
    return new Promise((resolve,reject)=>{
        pool.query("update user_tb set token=? where email=?",["",email],(e,r)=>{
            if(e){
                console.error("db.signout(): ",e);
                reject({error:"Could not log you out this time"});
            }
            else{
                resolve(true);
            }
        })
    })
}
//signup
exports.signUp =(email,password,token)=>{
    return new Promise((resolve,reject)=>{
        this.getUserWithEmail(email).then(result=>{
            if(result.data){
                reject({code:1,msg:"User already exists. Please go to sign in page"});
            }
            else{
                let sql = "insert into user_tb(email,password,token,date_created) values (?) on duplicate key update password=values(password),token=values(token),date_created=values(date_created)";
                bcrypt.hash(password,10)
                .then((hash)=>{
                    let now = Date.now();
                    let values = [email,hash,token,now]        
                    pool.query(sql,[values],(err,result)=>{
                        if(err){
                            console.error("db.signUp(): ",err);
                            reject({code:1,msg:"Could not signup user",error:err});
                        }
                        else{
                            this.getUser(result.insertId)
                            .then(u=>{
                                resolve(u)
                            }).catch(e=>{
                                resolve({code:-1,msg:"Successfully created user. Please go to sign in",error:e});
                            })
                            
                        }
                    })
                })
                .catch(e=>{
                    console.error("db.signup(): ",e);
                    reject({code:1,msg:"Could not signup user",error:e});
                })
                
            }
        })
        .catch(e=>{
            console.log("db.signUp(): ",e);
            reject({code:1,msg:"Could not retrieve user "+email,error:e});
        })
        
    })
}
exports.signIn = (email,password)=>{
    return new Promise((resolve,reject)=>{
        let sql = "select * from user_tb where email=?";
        pool.query(sql,[email],(err,row,field)=>{
            if(err){
                console.error("db.signIn(): ",err);
                reject({error:"Could not sign you in at the moment"})
            }
            else{
                if(row.length > 0){
                    let user = row[0];
                    bcrypt.compare(password,user.password,(err,success)=>{
                        if(err) reject("Signin failed. Check password");
                        if(success){
                            this.getClient(user.email).then(result=>{
                                user.detail = result.data;
                                resolve({code:0,msg:"successful",data:user});
                            })
                            .catch(e=>{
                                console.log("e: ",e);
                                resolve({code:0,msg:"successful",data:user});
                            })
                            
                        }
                        else reject({code:1,msg:"Invalid Password"});
                    });
                }
                else{
                    reject({code:1,msg:"User not found"});
                }
                
                
            }
        });
       
    });
    
}
exports.getUser = (userId)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error("db.getUser(): ",e);
                reject({code:1,msg:"Failed to connect to service",error:e});
            }
            else{
                con.query("select * from user_tb where id=?",[userId],(e,r,f)=>{
                    if(e){
                        console.error("db.getUser(): ",e);
                        reject({code:1,msg:"Could not retrieve user details",error:e});
                    }
                    else{
                        if(r.length > 0){
                            resolve({code:0,msg:"Successful",data:r[0]});
                        }
                        else reject({code:1,msg:"User does not exist"});
                    }
                    con.release();
                })
            }
        })
        
    })
}
exports.getUserWithEmail = (email)=>{
    return new Promise((resolve,reject)=>{
        pool.query("select * from user_tb where email=?",[email],(e,r,f)=>{
            if(e){
                console.error("db.getUser(): ",e);
                reject({code:1,msg:"Could not retrieve user details",error:e});
            }
            else{
                if(r.length > 0){
                    resolve({code:0,msg:"Successful",data:r[0]});
                }
                else resolve({code:1,msg:"Could not retrieve user details",error:"User does not exist"});
            }
        });
    })
   
}
exports.saveToken = (token,email)=>{
    return new Promise((resolve,reject)=>{
        pool.query("update user_tb set token=? where email=?",[token,email],(e,r)=>{
            if(e){
                console.error("db.saveToken(): ",e);
                reject("Could not save token");
            }
            else{
                resolve("Successful");
            }
        })
    })
}

//rolses
exports.createFeature = (data)=>{
    return new Promise((resolve,reject)=>{
        let sql = "insert into features_tb (name,description,label,parent) values (?) on duplicate key update name=values(name), description=values(description),parent=values(parent)";
        let values = [data.name,data.description,data.label,data.parent];
        pool.getConnection((e,con)=>{
            if(e){
                console.error("db.createFeature(): ",e);
                reject({code:1,msg:"Could not get connection to service",error:e});
            }
            else{
                con.query(sql,[values],(e,r)=>{
                    if(e){
                        con.release();
                        console.error("db.createFeature(): ",e);
                        reject({code:1,msg:"Could not create feature",error:e});
                    }
                    else{
                        con.release();
                        this.getFeatures().then(result=>{
                            resolve({code:0,msg:"Successfully created feature",data:result.data});
                        }).catch(e=>{
                            console.error("db.createFeature(): ",e);
                            resolve({code:0,msg:"Successfully, but could not retrieve features",data:[]})
                        })
                        
                    }
                })
            }
        })
       
    })
}
//delete features
exports.deleteFeature=(featureId)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+" db.deleteFeature(): ",e);
                reject({code:1,msg:"Could not establish connection to service",error:e});
            }
            else{
                con.query("delete from features_tb where id=?",[featureId],(e,r)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.deleteFeature(): ",e);
                        reject({code:1,msg:"Could not delete feature",error:e});
                    }
                    else{
                        con.release();
                        this.getFeatures().then(result=>{
                            resolve(result);
                        }).catch(er=>{
                            console.error(getTimeStamp()+" db.deleteFeature(): ",er);
                            reject(er);
                        })
                    }
                })
            }
        })
    })
}
//update features
exports.updateFeature=(feature)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+" db.updateFeature(): ",e);
                reject({code:1,msg:"Could not establish connection to service",error:e});
            }
            else{
                con.query("update features_tb set name=?,description=?,label=?,parent=? where id=?",[feature.name,feature.description,feature.label,feature.parent,feature.id],(e,r)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.updateFeature(): ",e);
                        reject({code:1,msg:"Could not update feature",error:e});
                    }
                    else{
                        con.release();
                        this.getFeatures().then(result=>{
                            resolve(result);
                        }).catch(er=>{
                            console.error(getTimeStamp()+" db.updateFeature(): ",er);
                            reject(er);
                        })
                    }
                })
            }
        })
    })
}
exports.getFeatures = ()=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error("db.getFeatures(): ",e);
                reject({code:1,msg:"Could not get connection to service"});
            }
            else{
                con.query("select * from features_tb",(e,r,f)=>{
                    if(e){
                        con.release();
                        console.error("db.getFeatures(): ",e);
                        reject({code:1,msg:"Could not retrieve the list of features"});
                    }
                    else{
                        con.release();
                        resolve({code:0,msg:"Successfully",data:r});
                    }
                });
            }
        })
        
    })
}

//rolses
exports.createRole = (data)=>{
    return new Promise((resolve,reject)=>{
        let sql = "insert into roles_tb (name,description,permission) values (?)";
        let values = [data.name,data.description,data.permission];
        pool.query(sql,[values],(e,r)=>{
            if(e){
                console.error("db.createRole(): ",e);
                reject({code:1,msg:"Could not create role",error:e});
            }
            else{
                this.getRoles().then(result=>{
                    resolve({code:0,msg:"Successfully created role",data:result.data});
                }).catch(e=>{
                    console.error("db.createRole(): ",e);
                    resolve({code:0,msg:"Successfully, but could not retrieve roles",data:[]})
                })
                
            }
        })
    })
}
//delete roles
exports.deleteRole=(roleId)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+" db.deleteRole(): ",e);
                reject({code:1,msg:"Could not establish connection to service",error:e});
            }
            else{
                con.query("delete from roles_tb where id=?",[roleId],(e,r)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.deleteRole(): ",e);
                        reject({code:1,msg:"Could not delete role",error:e});
                    }
                    else{
                        con.release();
                        this.getRoles().then(result=>{
                            resolve(result);
                        }).catch(er=>{
                            console.error(getTimeStamp()+" db.deleteRole(): ",er);
                            reject(er);
                        })
                    }
                })
            }
        })
    })
}
//update roles
exports.updateRole=(role)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+" db.updateRole(): ",e);
                reject({code:1,msg:"Could not establish connection to service",error:e});
            }
            else{
                con.query("update roles_tb set name=?,description=? where id=?",[role.name,role.description,role.id],(e,r)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.updateRole(): ",e);
                        reject({code:1,msg:"Could not update role",error:e});
                    }
                    else{
                        con.release();
                        this.getRoles().then(result=>{
                            resolve(result);
                        }).catch(er=>{
                            console.error(getTimeStamp()+" db.updateRole(): ",er);
                            reject(er);
                        })
                    }
                })
            }
        })
    })
}
exports.getRoles = ()=>{
    return new Promise((resolve,reject)=>{
        pool.query("select * from roles_tb",(e,r,f)=>{
            if(e){
                console.error("db.getRoles(): ",e);
                reject({code:1,msg:"Could not retrieve the list of roles"});
            }
            else{
                resolve({code:0,msg:"Successfully",data:r});
            }
        });
    })
}
//get client roles
exports.getClientRoles = (user_id)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(user_id).then(result=>{
            let user = result.data;
            var pool = this.getClientPool(user);
            var sql = "select * from roles order by level asc";
            pool.query(sql,(e,r)=>{
                if(e){
                    console.error("db.getClientRoles(): ",e);
                    reject({code:1,msg:"Could not retrieve client roles",error:e});
                }
                else{
                    resolve({code:0,msg:"Successful",data:r})
                }
            })
        })
        .catch(e=>{
            reject({code:1,msg:"Could not retrieve client roles",error:e})
        })
    });
}
//create client role
exports.createClientRole = (data)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(data.user_id)
        .then(result=>{
            let user = result.data;
            if(user.db.includes("space_")){
                var clientPool = this.getClientPool(user);
                clientPool.getConnection((er,con)=>{
                    if(er){
                        con.rollback(()=>{
                            con.release();
                            console.error("createClientSpace(): ",err);
                            reject({code:1,msg:"Could not get a connection to client space",error:er});
                        })
                    }
                    else{
                        let sql = "create table if not exists roles(id int(2) auto_increment primary key, name varchar(32) unique not null, description varchar(255),level int(2) not null)";
                        con.query(sql,(e,r)=>{
                            if(e){
                                console.error("db.createClientRole(): ",e);
                                con.rollback(()=>{
                                    con.release();
                                    reject({code:1,msg:"Could not create a role table in client space",error:e});
                                })
                            }
                            else{
                                sql = "insert into roles(name,description,level) values (?) on duplicate key update description=values(description),level=values(level)";
                                let values = [data.name,data.description,data.level];
                                con.query(sql,[values],(e,r)=>{
                                    if(e){
                                        con.rollback(()=>{
                                            console.error("db.createClientRole(): ",e);
                                            con.release();
                                            reject({code:1,msg:"Could not a add role",error:e});
                               
                                        })
                                    }
                                    else{
                                        con.commit((e)=>{
                                            if(e){
                                                console.error("db.createClientRole(): ",e);
                                                con.rollback(()=>{
                                                    con.release();
                                                    reject({code:1,msg:"Could not complete operation",error:e});
                               
                                                })
                                            }
                                            else{
                                                con.release();
                                                this.getClientRoles(data.user_id)
                                                    .then(result=>{
                                                        resolve(result);
                                                    })
                                                    .catch(err=>{
                                                        reject(err)
                                                    })
                                            }
                                        })
                                        
                                    }
                                })
                            }
                        })
                    }
                })
            }
           
        })
        .catch(er=>{
            console.error("db.createClientRole(): ",er);
            reject({code:1,msg:"Could not get user",error:er});
        })
    })
}
//delete client Role
exports.deleteClientRole = (user_id,role_id)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((err,con)=>{
            if(err){
                con.release();
                console.error(getTimeStamp()+" db.deleteClientRole(): ",err);
                reject({code:1,msg:"Could not connect to service",error:err});
            }
            else{
                this.getUser(user_id).then(result=>{
                    con.release();
                    if(result.data){
                        var clientPool = this.getClientPool(result.data);
                        clientPool.getConnection((e,conn)=>{
                            if(e){
                                conn.release();
                                console.error(getTimeStamp()+" db.deleteClientRole(): ",e);
                                reject({code:1,msg:"Could not connect to client space",error:e});
                            }
                            else{
                                conn.query("delete from roles where id=?",[role_id],(e,r)=>{
                                    if(e){
                                        conn.release();
                                        console.error(getTimeStamp()+" db.deleteClientRole(): ",e);
                                        reject({code:1,msg:"Could not connect to service",error:e});
                                    }
                                    else{
                                        conn.release();
                                        this.getClientRoles(user_id).then(result=>{
                                            resolve(result);
                                        }).catch(err=>{
                                            reject(err);
                                        })
                                    }
                                })
                            }
                        })
                    }
                    
                }).catch(err=>{
                    con.release();
                    console.error(getTimeStamp()+" db.deleteClientRole(): ",err);
                    reject({code:1,msg:"Could not connect to service",error:err});
                })
            }
        })
    })
}
//update client Role
exports.updateClientRole = (data)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(data.user).then(result=>{
            if(result.data){
                var clientPool = this.getClientPool(result.data);
                clientPool.getConnection((e,conn)=>{
                    if(e){
                        conn.release();
                        console.error(getTimeStamp()+" db.deleteClientRole(): ",e);
                        reject({code:1,msg:"Could not connect to client space",error:e});
                    }
                    else{
                        conn.query("update roles set name=?, description=?, level=? where id=?",[data.name,data.description,data.level,data.id],(e,r)=>{
                            if(e){
                                conn.release();
                                console.error(getTimeStamp()+" db.deleteClientRole(): ",e);
                                reject({code:1,msg:"Could not connect to service",error:e});
                            }
                            else{
                                conn.release();
                                this.getClientRoles(data.user).then(result=>{
                                    resolve(result);
                                }).catch(err=>{
                                    reject(err);
                                })
                            }
                        })
                    }
                })
            }
            
        })
        .catch(err=>{
            console.error(getTimeStamp()+" db.updateClientRole(): ",err);
            reject({code:1,msg:"Could not retrieve user",error:err});
        })
    })
}