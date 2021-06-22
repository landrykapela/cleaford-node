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
exports.createClientSpace = (user)=>{
    return new Promise((resolve,reject)=>{
    pool.getConnection((err,connection)=>{
        connection.beginTransaction((err)=>{
            if(err){
                connection.rollback(()=>{
                    connection.release();
                    console.error("createClientDb(): ",err);
                reject("Could not create client space")
                })
                
            }
            else{
                connection.query("create database if not exists space_"+user.ref,(e,r,f)=>{
                    if(e){
                        connection.rollback(()=>{
                            connection.release();
                            console.error("createClientDb(): ",e);
                            reject("failed to create client space");
                        })
                        
                    }
                    else{
                        connection.query("create user '"+user.ref+"_admin'@'localhost' identified mysql_native_password by "+user.password,(e,r,f)=>{
                            if(e){
                                connection.rollback(()=>{
                                    connection.release();
                                    console.error("createClientDb(): ",e);
                                    reject("failed to add user to client space");
                                })
                            }
                            else{
                                connection.query("GRANT ALL PRIVILEGES ON space_"+user.ref+".* TO '"+user.ref+"_admin'@'localhost'",(e,r)=>{
                                    if(e){
                                        connection.rollback(()=>{
                                            connection.release();
                                            console.error("createClientDb(): ",e);
                                            reject("failed to add user to client space");
                                        })
                                    }
                                    else{
                                        connection.query("FLUSH PRIVILEGES",(e,r)=>{
                                            connection.commit((e)=>{
                                                if(e){
                                                    connection.rollback(()=>{
                                                        connection.release();
                                                        console.error("createClientDb(): ",e);
                                                        reject("failed to generate client space");
                                                    }) 
                                                }
                                                else{
                                                    connection.release();
                                                    resolve("successfully created client space");
                                                }
                                            })
                                            
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
}

//get client pool
exports.getClientPool = (user)=>{
    return mysql.createPool({
        socketPath:config.socket,host:config.host,
        user: user.ref+"_admin",
        database: "space_"+user.ref,
        password: user.password,
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

//signup
exports.signUp =(user)=>{
    return new Promise((resolve,reject)=>{
        let sql = "insert into root_tb(ref,db,email,password,token) values (?)";
        let ref = crypto.randomBytes(8).toString('hex');
        let db = "space_"+ref;
        bcrypt.hash(data.password,10).then((hash)=>{
            let values = [ref,db,user.email,hash,user.token]        
            pool.query(sql,[values],(err,result)=>{
                if(err){
                    console.error("db.signUp(): ",err);
                    reject("Could not signup user");
                }
                else{
                    db.getUser(result.insertId)
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
        let sql = "select email,password from root_tb where email=?";
        pool.query(sql,[email],(err,row,field)=>{
            if(err){
                console.error("db.signIn(): ",err);
                reject("Could not sign you in at the moment")
            }
            else{
                console.log("result: ",password)
                let user = row[0];
                bcrypt.compare(password,user.password,(err,result)=>{
                    if(result)resolve(user);
                    else{reject("Signin failed. Check password")}
                })
                
                
            }
        })
       
    });
    
}
exports.getUser = (userId)=>{
    return new Promise((resolve,reject)=>{
        pool.query("select id,db,ref,email,token where id=?",[userId],(e,r,f)=>{
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
exports.updateToken = (token,user)=>{
    return new Promise((resolve,reject)=>{
        pool.query("update root_tb set token=? where email=?",[token,user.email],(e,r)=>{
            if(e){
                console.error("db.updateToken(): ",e);
                reject("Could not save token");
            }
            else{
                resolve("successful");
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