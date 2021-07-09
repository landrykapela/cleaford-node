const mysql = require("mysql");
const config = require("./config.json");
const bcrypt = require("bcrypt");
require("dotenv").config();
const fs = require('fs');


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
            console.log("testing..."+user);
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
                    var sql = "insert into client_tb (region,status,logo,name,address,email,phone,contact_person,contact_email,date_created) values (?) on duplicate key update status=values(status),logo=values(logo),name=values(name),address=values(address),phone=values(phone),contact_person=values(contact_person)";
                    let values = [data.region,1,data.logo,data.name,data.address,data.email,data.phone,data.contact_person,data.contact_email,Date.now()]
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
                                    console.log("db.createClient(): ","successful");
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
    console.log("updating...",data);
    return new Promise((resolve,reject)=>{
        console.log("getting client by id ",data.id);
        this.getClientById(data.id).then(rs=>{
            console.log("complete search of client");
            if(rs.code == 0){
                console.log("got client id ",rs.data.id);
                let login_email = rs.data.contact_email;
                if(login_email != data.contact_email){
                    pool.query("update user_tb set email=? where email=?",[data.contact_email,login_email],(e,r)=>{
                        if(e){
                            console.error("db.updateClient(): ",e);
                        }
                       
                    })
                }
                
                let sql = "update client_tb set region=?,phone=?,name=?,email=?,address=?,contact_person=?,contact_email=?,logo=? where id=?";
                console.log("sql: ",sql);
                let values = [data.region,data.phone,data.name,data.email,data.address,data.contact_person,data.contact_email,data.logo,data.id];
                pool.query(sql,values,(e,r)=>{
                    if(e){
                        console.error("db.updateClient(): ",e);
                        reject({code:1,msg:"Could not update client data"});
                    }
                    else{
                        if(data.user && data.user ==0){
                            this.getClientList().then(clients=>{
                                resolve({code:0,msg:"Successfully updated Client data",data:clients.data});
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
                else reject({code:1,msg:"No client information"})
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
                console.log("test2 from getClient: ",r[0]);
                resolve({code:0,msg:"Successful",data:r[0]});
            }
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
        let sql = "insert into user_tb(email,password,token,date_created) values (?) on duplicate key update password=values(password),token=values(token),date_created=values(date_created)";
        // let ref = crypto.randomBytes(4).toString('hex');
        // let db = "space_"+ref;
        bcrypt.hash(password,10).then((hash)=>{
            let now = Date.now();
            let values = [email,hash,token,now]        
            pool.query(sql,[values],(err,result)=>{
                if(err){
                    console.error("db.signUp(): ",err);
                    reject({code:1,msg:"Could not signup user"});
                }
                else{
                    this.getUser(result.insertId)
                    .then(u=>{
                        resolve(u)
                    }).catch(e=>{
                        resolve(user);
                    })
                    
                }
            })
        })
        .catch(e=>{
            console.error("db.signup(): ",e)
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
                        else reject({error:"Invalid Password"});
                    });
                }
                else{
                    reject({error:"User not found"});
                }
                
                
            }
        });
       
    });
    
}
exports.getUser = (userId)=>{
    return new Promise((resolve,reject)=>{
        pool.query("select * from user_tb where id=?",[userId],(e,r,f)=>{
            if(e){
                console.error("db.getUser(): ",e);
                reject({code:1,msg:"Could not retrieve user details",error:e});
            }
            else{
                if(r.length > 0){
                    resolve({code:0,msg:"Successful",data:r[0]});
                }
                else reject({code:1,msg:"Could not retrieve user details",error:"User does not exist"});
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
                else reject({code:1,msg:"Could not retrieve user details",error:"User does not exist"});
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
exports.getCustomers = ()=>{
    return new Promise((resolve,reject)=>{
        console.log("getting customers...");
        resolve("successful");
    });
}

exports.getCustomers = ()=>{
    return new Promise((resolve,reject)=>{
        console.log("getting customers...");
        resolve("successful");
    });
}

//rolses
exports.createRole = (data)=>{
    return new Promise((resolve,reject)=>{
        let sql = "insert into roles_tb (name,description,permission) values (?)";
        let values = [data.name,data.description,data.permission];
        pool.query(sql,[values],(e,r)=>{
            if(e){
                console.error("db.createRole(): ",e);
                reject({code:1,msg:"Could not create role"});
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
                    console.log("success: ",r);
                    resolve({code:0,msg:"Successful",data:r})
                }
            })
        })
        .catch(e=>{
            reject(e)
        })
    });
}
//create client role
exports.createClientRole = (data)=>{
    console.log("my data; ",data);
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