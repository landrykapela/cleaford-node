const mysql = require("mysql");
const config = require("./config.json");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { connect } = require("../app");


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

//generate random string
exports.generateRef = (length)=>{
    return crypto.randomBytes(length).toString('hex');
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
exports.createClientSpace = (email)=>{

    return new Promise((resolve,reject)=>{
    var ref = randomString(8);
    var password = randomString(10);
    this.getUserWithEmail(email).then(user=>{
        console.log("testing..."+user.email);
            pool.getConnection((err,connection)=>{
                connection.beginTransaction((err)=>{
                    if(err){
                        connection.rollback(()=>{
                            connection.release();
                            console.error("createClientDb(): ",err);
                            reject("Could not create client space");
                        })
                        
                    }
                    else{
                        connection.query("create database if not exists space_"+ref,(e,r,f)=>{
                            if(e){
                                connection.rollback(()=>{
                                    connection.release();
                                    console.error("createClientDb(): ",e);
                                    reject("failed to create client space");
                                })
                                
                            }
                            else{
                                 connection.query("create user '"+ref+"_admin'@'localhost' identified mysql_native_password by "+password,(e,r,f)=>{
                                    if(e){
                                        connection.rollback(()=>{
                                            connection.release();
                                            console.error("createClientDb(): ",e);
                                            reject("failed to add user to client space");
                                        })
                                    }
                                    else{
                                        connection.query("GRANT ALL PRIVILEGES ON space_"+ref+".* TO '"+ref+"_admin'@'localhost'",(e,r)=>{
                                            if(e){
                                                connection.rollback(()=>{
                                                    connection.release();
                                                    console.error("createClientDb(): ",e);
                                                    reject("failed to add user to client space");
                                                })
                                            }
                                            else{
                                                connection.query("FLUSH PRIVILEGES",(e,r)=>{
                                                   
                                                        if(e){
                                                            connection.rollback(()=>{
                                                                connection.release();
                                                                console.error("createClientSpace(): ",e);
                                                                reject("failed to generate client space");
                                                            }) 
                                                        }
                                                        else{
                                                            connection.query("update user_tb set db='space_"+ref+"' where email=?",[email],(e,r)=>{
                                                                if(e){
                                                                    connection.rollback(()=>{
                                                                        connection.release();
                                                                        console.error("db.createClientSpace(): ",e);
                                                                        reject("Failed to update user table");
                                                                    })
                                                                }
                                                                else{
                                                                    connection.commit((e)=>{
                                                                        if(e){
                                                                            connection.rollback(()=>{
                                                                                connection.release();
                                                                                console.error("db.createClientSpace(): ",e);
                                                                                reject("Failed to update user table");
                                                                            })
                                                                        }
                                                                        else{
                                                                            connection.release();
                                                                            resolve("successfully created client space");
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
            reject({error:"Could not create client space"});
        })
    })
   
}

//get client pool
exports.getClientPool = (user)=>{
    let prefix = user.email.split("@")[0];
    return mysql.createPool({
        socketPath:config.socket,host:config.host,
        user: prefix+"_admin",
        database: "space_"+prefix,
        password: 'admin',
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
                        reject("Failed to create client");
                    });
                }
                else{
                    var sql = "insert into client_tb (name,address,email,phone,contact_person,contact_email,date_created) values (?)";
                    let values = [data.name,data.address,data.email,data.phone,data.contact_person,data.contact_email,Date.now()]
                    conn.query(sql,[values],(er,res)=>{
                        if(er){
                            conn.rollback(()=>{
                                conn.release();
                                console.error("db.createClient(): ",er);
                                reject("Failed to add client");
                            });
                        }
                        else{
                            conn.commit((e)=>{
                                if(e){
                                    conn.rollback(()=>{
                                        conn.release();
                                        console.error("db.createClient(): ",err);
                                        reject("Failed to commit client");
                                    });
                                }
                                else{
                                    conn.release();
                                    console.log("db.createClient(): ","successful");
                                    resolve("Successul");
                                }
                            })
                        }
                    })
                }
            })
        })
         pool.query(sql,[values],(error,rows,field)=>{
            if(error){
                console.error("db.createClient(): ",error);
                reject("Could not create client");
            }
            else{
                console.log("result:",rows);
                resolve("Successful");
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
exports.signUp =(user)=>{
    return new Promise((resolve,reject)=>{
        let sql = "insert into user_tb(email,password,token,date_created) values (?)";
        // let ref = crypto.randomBytes(4).toString('hex');
        // let db = "space_"+ref;
        bcrypt.hash(user.password,10).then((hash)=>{
            let values = [user.email,hash,user.token,Date.getTime()]        
            pool.query(sql,[values],(err,result)=>{
                if(err){
                    console.error("db.signUp(): ",err);
                    reject("Could not signup user");
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
        let sql = "select email,password from user_tb where email=?";
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
                        if(success)resolve(user);
                        reject({error:"Invalid Password"});
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
                reject("Could not retrieve user details");
            }
            else{
                if(r.length > 0){
                    resolve(r[0]);
                }
            }
        })
    })
}
exports.getUserWithEmail = (email)=>{
    return new Promise((resolve,reject)=>{
        pool.query("select * from user_tb where email=?",[email],(e,r,f)=>{
            if(e){
                console.error("db.getUser(): ",e);
                reject("Could not retrieve user details");
            }
            else{
                if(r.length > 0){
                    resolve(r[0]);
                }
            }
        });
    })
   
}
exports.saveToken = (token,user)=>{
    return new Promise((resolve,reject)=>{
        pool.query("update user_tb set token=? where email=?",[token,user.email],(e,r)=>{
            if(e){
                console.error("db.saveToken(): ",e);
                reject("Could not save token");
            }
            else{
                this.getUserWithEmail(user.email)
                .then(user=>{
                    resolve(user);
                })
                
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