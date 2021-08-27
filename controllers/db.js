const mysql = require("mysql");
const config = require("./config.json");
const bcrypt = require("bcrypt");
require("dotenv").config();
const fs = require('fs');

//consignment status
const CONSIGNMENT_STATUS = [
    {id:1,status:"Pending Ship Booking"},
    {id:2,status:"Pending Ship Booking"},
    {id:3,status:"Pending ODG Certificates"},
    {id:4,status:"Pending ODG Certificates"},
    {id:5,status:"Pending Custom Release"}, 
    {id:6,status:"Pending Loading Permission"},
    {id:7,status:"Pending Export Permit"},
    {id:8,status:"Pending Screening"},
    {id:9,status:"Pending Bill of Lading"},
    {id:10,status:"Completed"},
    {id:11,status:"Closed"}]
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

//check if table exists
const doesTableExist = (tableName,userId)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId)
        .then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                pool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.doesTableExist(): ",e);
                        reject(false);
                    }
                    else{
                        con.query("show tables",(e,r)=>{
                            con.release();
                            var key = "Tables_in_"+result.data.db;
                            if(r && r.length > 0){
                                var table = r.filter(i=>i[key].toLowerCase() == tableName.toLowerCase());
                                if(table.length > 0) {
                                    resolve(true);
                                }
                                else{
                                    resolve(false);
                                }
                            }
                            else resolve(false);
                        })
                    }
                })
               
            }
            else{
                resolve(false);
            }
        }).catch(e=>{
            reject(false)
        })
    })
}
//get client pool
const getClientPool = (user)=>{
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

//save base64 to file
const saveFile = (encodedData,options)=>{
    console.log("trying to save file...");
    return new Promise((resolve,reject)=>{
        if(options == null || options == undefined) reject(false);
        if(encodedData == null || encodedData == undefined)  reject(false);
        if(options.user == null || options.user == undefined)  reject(false);
        if(options.refer_id == null || options.refer_id == undefined)  reject(false);
        if(options.target == null || options.target == undefined)  reject(false);
    
        console.log("cheking user");
        this.getUser(options.user)
            .then(result=>{
                if(result.data){
                    console.log("user ok");
                    var pool= getClientPool(result.data);
                    var parts = encodedData.split(";base64,");
                    if(typeof parts == "object" && parts.length > 1){
                        var data = parts[1];
                        var ext = "."+parts[0].split("/")[1];
                        var name = randomString(10);
                        var filename = (options.filename) ? options.filename.split(".")[0]+ext : name+ext;
                        if(options.name) name = options.name; 
                        console.log("writing file...");
                        var path = "data/"+ ((options.target.toLowerCase() == "customer_tb") ? "customers/" :"");
                        path += filename;
                        fs.writeFile(path,data,{encoding:'base64'},(e)=>{
                            if(e) {
                            console.error(getTimeStamp()+" db.saveFile() writing error: ",e);
                            reject(false);
                            }
                            else{
                                console.log("creating db record of file");
                                var sql = "insert into user_files (name,refer_id,target,filename) values(?) on duplicate key update name=values(name),target=values(target)";
                                var values = [[name,options.refer_id,options.target,filename]];
                                if(options.isUpdate) {
                                    sql = "update user_files set filename=? where refer_id=? and name=?";
                                    values = [filename,options.refer_id,options.name];
                                }
                                pool.getConnection((e,con)=>{
                                    if(e){
                                        console.log("no connection to db; deleting file...");
                                        fs.unlink(path,(e)=>{
                                            if(e) console.error(getTimeStamp()+" saveFile() deleting: ",e);
                                        })
                                        console.error(getTimeStamp()+" saveFile() no connection: ",e);
                                        reject(false);
                                    }
                                    else{
                                        con.query(sql,values,(e,r)=>{
                                            con.release();
                                            if(e){
                                                console.log("error inserting record; deleting file...");
                                                fs.unlink(path,(e)=>{
                                                    if(e) console.error(getTimeStamp()+" saveFile() deleting: ",e);
                                                })
                                                console.error(getTimeStamp()+" saveFile() sql: ",e);
                                                reject(false);
                                            }
                                            else{
                                                console.log("success");
                                                resolve(true);
                                            }
                                        })
                                    }
                                })
                            }
                        });
                    }
                    else{
                        console.log("bad data");
                        reject(false);
                    }
                }
                else{
                    console.log("no user data");
                    reject(false);
                }
            })
            .catch(er=>{
                console.error(getTimeStamp()+" saveFile(): ",er);
                reject(false);
            }) 
          
    })
   
}

//get file using file id
exports.getFileWithId =(userId,fileId)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId)
        .then(result=>{
            var pool= getClientPool(result.data);
            pool.getConnection((e,con)=>{
                if(e){
                    console.error(getTimeStamp()+" db.getFileWith(): ",e)
                    reject({code:1,msg:"Could not get connection to service",error:e});
                }
                else{
                    con.query("select * from user_files where id=?",[fileId],(e,r)=>{
                        if(e){
                            console.error(getTimeStamp()+" db.getFileWithId(): ",e)
                            reject({code:1,msg:"Cannot get user file",error:e});
                        }
                        else{
                            console.log("fwid: "+fileId,r);
                            resolve({code:0,msg:"Successful",data:r[0]})
                        }
                        con.release();
                    })
                }
            })
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.getFileWithId(): ",e);
            reject(e);
        })
    })
}
//delete file
exports.deleteFile = (data)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(data.userId)
        .then(result=>{
            var user = result.data;
            this.getFileWithId(data.userId,data.fileId)
            .then(result=>{
                if(result.data){
                    var pool= getClientPool(user);
                    pool.getConnection((e,con)=>{
                        if(e){
                            console.error(getTimeStamp()+" db.deleteFile(): ",e)
                            reject({code:1,msg:"Could not get connection to service",error:e});
                        }
                        else{
                            con.query("delete from user_files where id=?",[data.fileId],(e,r)=>{
                                if(e){
                                    console.error(getTimeStamp()+" db.deleteFile(): ",e)
                                    reject({code:1,msg:"Cannot delete user files",error:e});
                                }
                                else{
                                    fs.unlink("data/"+result.data.filename,(e)=>{
                                        if(e){
                                            console.error(getTimeStamp()+" db.deleteFile(): ",e)
                                            reject({code:1,msg:"Cannot delete user file",error:e});
                                        }
                                    });
                                    this.getConsignments(data.userId).then(result=>{
                                        resolve({code:0,msg:"File was successfully deleted",data:result.data})
                                    })
                                    .catch(e=>{
                                        reject(e)
                                    })
                                }
                                con.release();
                            })
                        }
                    })
                    
                }
                else{
                    reject({code:1,msg:"Invalid file id"});
                }
            })
           
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.deleteFile(): ",e);
            reject(e);
        })
    })
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

// create client
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
                    var sql = "insert into client_tb (code,tin,country,region,status,logo,name,address,email,phone,contact_person,contact_email,date_created) values (?) on duplicate key update status=values(status),logo=values(logo),name=values(name),address=values(address),phone=values(phone),contact_person=values(contact_person),country=values(country),region=values(region)";
                    let values = [data.code,data.tin,data.country,data.region,1,data.logo,data.name,data.address,data.email,data.phone,data.contact_person,data.contact_email,Date.now()]
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
                
                let sql = "update client_tb set code=?, tin=?, country=?,region=?,phone=?,name=?,email=?,address=?,contact_person=?,contact_email=?,logo=? where id=?";
                let values = [data.code,data.tin,data.country,data.region,data.phone,data.name,data.email,data.address,data.contact_person,data.contact_email,data.logo,data.id];
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
    var inc_cert = data.inc_cert;
    var tin_cert = data.tin_cert;
    delete data.inc_cert;
    delete data.tin_cert;
    return new Promise((resolve,reject)=>{
        this.getUser(data.user)
        .then(result=>{
            let user = result.data;
            let pool = getClientPool(user);
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
                            let sql = "create table if not exists customer_tb (id int(10) auto_increment primary key,name varchar(50) not null, email varchar(255) unique not null,address varchar(255),region varchar(50), country varchar(50),contact_person varchar(50),contact_email varchar(50),phone varchar(15) not null,tin varchar(20),tin_file varchar(50),incorporation_file varchar(50))";
                            conn.query(sql,(e,r)=>{
                                if(e){
                                    conn.rollback((e)=>{
                                        conn.release();
                                        console.error("db.createCustomer(): ",e);
                                        reject({code:1,msg:"Something went wrong. Please try again later",error:e});    
                                    });
                                }
                                else{
                                   
                                    let sql = "insert into customer_tb (tin,name,address,region,country,email,phone,contact_email,contact_person) values(?) on duplicate key update region=values(region),contact_email=values(contact_email),country=values(country),address=values(address),phone=values(phone),contact_person=values(contact_person)";
                                    let values = [data.tin,data.company_name,data.address,data.region,data.country,data.email,data.phone,data.contact_email,data.contact_person];
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
                                            if(tin_cert != null){
                                                var filename = data.tin_file;
                                                var isUpdate = true;
                                                if(filename ==null || filename == undefined){
                                                    var ext = tin_cert.split(";base64,")[0].split("/")[1];
                                                    filename = randomString(10)+"."+ext;
                                                    isUpdate = false;
                                                }
                                                saveFile(tin_cert,{name:"TIN Certificate",user:data.user,refer_id:r.insertId,target:"customer_tb",filename:filename,isUpdate:isUpdate})
                                                .then(successful=>{
                                                    if(successful){
                                                        conn.query("update customer_tb set tin_file=? where id=?",[filename,r.insertId],(e,rs)=>{
                                                            if(e){
                                                                conn.rollback((e)=>{
                                                                    console.error("db.updateCustomer(): ",e);
                                                                    reject({code:1,msg:"Could not update incoropration certificate file info"});
                                                                    conn.destroy();
                                                                })
                                                            }
                                                            else{
                                                                if(inc_cert != null){
                                                                    var filename = data.incorporation_file;
                                                                    var isUpdate = true;
                                                                    if(filename ==null || filename == undefined){
                                                                        var ext = inc_cert.split(";base64,")[0].split("/")[1];
                                                                        filename = randomString(10)+"."+ext;
                                                                        isUpdate = false;
                                                                    }
                                                                    saveFile(inc_cert,{name:"Incorporation Certificate",user:data.user,refer_id:r.insertId,target:"customer_tb",filename:filename,isUpdate:isUpdate})
                                                                    .then(successful=>{
                                                                        if(successful){
                                                                            conn.query("update customer_tb set incorporation_file=? where id=?",[filename,r.insertId],(e,rs)=>{
                                                                                if(e){
                                                                                    conn.rollback((er)=>{
                                                                                        console.error("db.createCustomer(): ",er);
                                                                                        reject({code:1,msg:"Could not update incoropration certificate file info"});
                                                                                        conn.destroy();
                                                                                    })
                                                                                }
                                                                                else{
                                                                                    if(conn.commit()){
                                                                                        this.getCustomersList(data.user)
                                                                                        .then(result=>{
                                                                                            resolve(result);
                                                                                        })
                                                                                        .catch(err=>{
                                                                                            console.error("db.createCustomer(): ",err);
                                                                                            reject(err);
                                                                                        })
                                                                                        .finally(()=>{
                                                                                            conn.release();
                                                                                            conn.destroy();
                                                                                        })
                                                                                    }
                                                                                    else{
                                                                                        conn.rollback((er)=>{
                                                                                            console.error("db.createCustomer(): ",er);
                                                                                            reject({code:1,msg:"Could not update incoropration certificate file info"});
                                                                                            conn.destroy();
                                                                                        })
                                                                                    }
                                                                                    
                                                                                }
                                                                            });
                                                                        }
                                                                        else{
                                                                            conn.rollback((er)=>{
                                                                                console.error("db.createCustomer(): ",er);
                                                                                reject({code:1,msg:"Could not save certificate file"});
                                                                                conn.destroy();
                                                                            })
                                                                        }
                                                                    })
                                                                    .catch(e=>{
                                                                        conn.rollback((er)=>{
                                                                            console.error("db.createCustomer(): ",er);
                                                                            reject({code:1,msg:"Failed not save certificate file"});
                                                                            conn.destroy();
                                                                        })
                                                                    })
                                            
                                                                }
                                                                else{
                                                                    if(conn.commit()){
                                                                        this.getCustomersList(data.user)
                                                                        .then(result=>{
                                                                            resolve(result);
                                                                        })
                                                                        .catch(err=>{
                                                                            console.error("db.updateCustomer(): ",err);
                                                                            reject(err);
                                                                        })
                                                                        conn.release();
                                                                        conn.destroy();
                                                                    }
                                                                    else{
                                                                        conn.rollback((er)=>{
                                                                            console.error("db.createCustomer(): ",er);
                                                                            reject({code:1,msg:"Failed not save certificate file"});
                                                                            conn.destroy();
                                                                        })
                                                                    }
                                                                }
                                                            }
                                                        })
                                                        
                                                    }
                                                    else{
                                                        reject({code:1,msg:"Could not save TIN certificate file"})
                                                    }
                                                })
                        
                                            }
                                            else{
                                                if(inc_cert != null){
                                                    var filename = data.incorporation_file;
                                                    var isUpdate = true;
                                                    if(filename ==null || filename == undefined){
                                                        var ext = inc_cert.split(";base64,")[0].split("/")[1];
                                                        filename = randomString(10)+"."+ext;
                                                        isUpdate = false;
                                                    }
                                                    saveFile(inc_cert,{name:"Incorporation Certificate",user:data.user,refer_id:r.insertId,target:"customer_tb",filename:filename,isUpdate:isUpdate})
                                                    .then(successful=>{
                                                        if(successful){
                                                            pool.query("update customer_tb set incorporation_file=? where id=?",[filename,r.insertId],(e,r)=>{
                                                                if(e){
                                                                    console.error("db.updateCustomer(): ",e);
                                                                    reject({code:1,msg:"Could not update incoropration certificate file info"});
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
                                                            
                                                        }
                                                        else{
                                                            console.error("db.updateCustomer(): ");
                                                            reject({code:1,msg:"Could not save certificate file"});  
                                                        }
                                                    })
                                                    .catch(e=>{
                                                        console.error("db.updateCustomer(): ",e);
                                                        reject({code:1,msg:"Failed save certificate file"});
                                                    })
                            
                                                }
                                            }
                                           
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
    var inc_cert = data.inc_cert;
    var tin_cert = data.tin_cert;
    delete data.inc_cert;
    delete data.tin_cert;
    return new Promise((resolve,reject)=>{
        this.getUser(data.user)
        .then(result=>{
            let pool = getClientPool(result.data);
            let sql = "update customer_tb set tin=?, name=?,address=?,country=?,region=?,email=?,phone=?,contact_person=?,contact_email=? where id=?";
            let values = [data.tin,data.name,data.address,data.country,data.region,data.email,data.phone,data.contact_person,data.contact_email,data.id];
            pool.query(sql,values,(e,r)=>{
                if(e){
                    console.error("db.updateCustomer(): ",e);
                    reject({code:1,msg:"Could not update customer record",error:e});
                }
                else{
                    if(tin_cert != null){
                        var filename = data.tin_file;
                        var isUpdate = true;
                        if(filename ==null || filename == undefined){
                            var ext = tin_cert.split(";base64,")[0].split("/")[1];
                            filename = randomString(10)+"."+ext;
                            isUpdate = false;
                        }
                        saveFile(tin_cert,{name:"TIN Certificate",user:data.user,refer_id:data.id,target:"customer_tb",filename:filename,isUpdate:isUpdate})
                        .then(successful=>{
                            if(successful){
                                pool.query("update customer_tb set tin_file=? where id=?",[filename,data.id],(e,r)=>{
                                    if(e){
                                        console.error("db.updateCustomer(): ",e);
                                        reject({code:1,msg:"Could not update incoropration certificate file info"});
                                    }
                                    else{
                                        if(inc_cert != null){
                                            var filename = data.incorporation_file;
                                            var isUpdate = true;
                                            if(filename ==null || filename == undefined){
                                                var ext = inc_cert.split(";base64,")[0].split("/")[1];
                                                filename = randomString(10)+"."+ext;
                                                isUpdate = false;
                                            }
                                            saveFile(inc_cert,{name:"Incorporation Certificate",user:data.user,refer_id:data.id,target:"customer_tb",filename:filename,isUpdate:isUpdate})
                                            .then(successful=>{
                                                if(successful){
                                                    pool.query("update customer_tb set incorporation_file=? where id=?",[filename,data.id],(e,r)=>{
                                                        if(e){
                                                            console.error("db.updateCustomer(): ",e);
                                                            reject({code:1,msg:"Could not update incoropration certificate file info"});
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
                                                    });
                                                }
                                                else{
                                                    console.error("db.updateCustomer(): ");
                                                    reject({code:1,msg:"Could not save certificate file"});  
                                                }
                                            })
                                            .catch(e=>{
                                                console.error("db.updateCustomer(): ",e);
                                                reject({code:1,msg:"Failed save certificate file"});
                                            })
                    
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
                                    }
                                })
                                
                            }
                            else{
                                reject({code:1,msg:"Could not save TIN certificate file"})
                            }
                        })

                    }
                    else{
                        if(inc_cert != null){
                            var filename = data.incorporation_file;
                            var isUpdate = true;
                            if(filename ==null || filename == undefined){
                                var ext = inc_cert.split(";base64,")[0].split("/")[1];
                                filename = randomString(10)+"."+ext;
                                isUpdate = false;
                            }
                            saveFile(inc_cert,{name:"Incorporation Certificate",user:data.user,refer_id:data.id,target:"customer_tb",filename:filename,isUpdate:isUpdate})
                            .then(successful=>{
                                if(successful){
                                    pool.query("update customer_tb set incorporation_file=? where id=?",[filename,data.id],(e,r)=>{
                                        if(e){
                                            console.error("db.updateCustomer(): ",e);
                                            reject({code:1,msg:"Could not update incoropration certificate file info"});
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
                                    
                                }
                                else{
                                    console.error("db.updateCustomer(): ");
                                    reject({code:1,msg:"Could not save certificate file"});  
                                }
                            })
                            .catch(e=>{
                                console.error("db.updateCustomer(): ",e);
                                reject({code:1,msg:"Failed save certificate file"});
                            })
    
                        }
                    }
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
                var pool = getClientPool(user);
                let sql = "select * from customer_tb order by name asc";
                pool.getConnection((e,con)=>{
                    if(e){
                        console.error("db.getCustomerList(): ",e);
                        reject({code:1,msg:"Could not connection to service",error:e});
                    }
                    else{
                        con.query(sql,(e,r)=>{
                            con.release();
                            if(e){
                                console.error("db.getCustomerList(): ",e);
                                reject({code:1,msg:"Could not retrieve the list of customers",error:e});
                            }
                            else{
                                let customers = r;
                                this.getAllUserFiles(userId)
                                .then(result=>{
                                    var files = result.data;
                                    let newCusomerList = customers.map(c=>{
                                        let nCust = c;
                                        nCust.files = files.filter(f=>f.refer_id == c.id);
                                        return nCust;
                                    });
                                    resolve({code:0,msg:"Successful",data:newCusomerList});
                                })
                                .catch(e=>{
                                    resolve({code:0,msg:"Successful",data:customers});
                                })
                                
                            }
                        });
                    }
                })
                
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
            console.error(getTimeStamp()+" db.signUp(): ",e);
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
                                console.error(getTimeStamp()+"signIn(): ",e);
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
                    con.release();
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
                })
            }
        })
        
    })
}
exports.getUserWithEmail = (email)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error("db.getUserByEmail(): ",e);
                reject({code:1,msg:"Could not get connection to service",error:e});
            }
            else{
                con.query("select * from user_tb where email=?",[email],(e,r,f)=>{
                    con.release();
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
            }
           
        })
       
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
                    con.release();
                    if(e){
                        con.release();
                        console.error("db.createFeature(): ",e);
                        reject({code:1,msg:"Could not create feature",error:e});
                    }
                    else{
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
                    con.release();
                    if(e){
                        console.error(getTimeStamp()+" db.deleteFeature(): ",e);
                        reject({code:1,msg:"Could not delete feature",error:e});
                    }
                    else{
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
                    con.release();
                    if(e){
                        console.error(getTimeStamp()+" db.updateFeature(): ",e);
                        reject({code:1,msg:"Could not update feature",error:e});
                    }
                    else{
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
                    con.release();
                    if(e){
                        console.error("db.getFeatures(): ",e);
                        reject({code:1,msg:"Could not retrieve the list of features"});
                    }
                    else{
                        resolve({code:0,msg:"Successfully",data:r});
                    }
                });
            }
        })
        
    })
}
exports.getFeaturesMultiple = (featureIds)=>{
    return new Promise((resolve,reject)=>{
        if(typeof featureIds == "object"){
            pool.getConnection((e,con)=>{
                if(e){
                    console.error("db.getFeatures(): ",e);
                    reject({code:1,msg:"Could not get connection to service"});
                }
                else{
                    let sql = "select * from features_tb where ";
                    featureIds.forEach((id,i)=>{
                        if(i >= featureIds.length -1) sql +="id=? ";
                        else sql += "id=? or ";
                    });

                    con.query(sql,featureIds,(e,r,f)=>{
                        con.release();
                        if(e){
                            console.error("db.getFeatures(): ",e);
                            reject({code:1,msg:"Could not retrieve the list of features"});
                        }
                        else{
                            resolve({code:0,msg:"Successfully",data:r});
                        }
                    });
                }
            })     
        }
       else reject({code:1,msg:"Invalid id"});
        
    })
}
exports.getFeature = (featureId)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+" db.getSubscriptionPackages(): ",e);
                reject({code:1,msg:"Could not get connection to service",error:e});
            }
            else{
                con.query("select * from features_tb where id=?",[featureId],(e,r)=>{
                    con.release();
                    if(e){
                        console.error(getTimeStamp()+" db.getSubscriptionPackages(): ",e);
                        reject({code:1,msg:"Could not get feature",error:e});
                    }
                    else{
                        resolve({code:0,msg:"Success",data:r});
                    }
                })
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
                    con.release();
                    if(e){
                        console.error(getTimeStamp()+" db.deleteRole(): ",e);
                        reject({code:1,msg:"Could not delete role",error:e});
                    }
                    else{
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
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+"db.getRoles(): ",e);
                reject({code:1,msg:"Could not get connnection to service",error:e});
            }
            else{
                con.query("select * from roles_tb",(e,r,f)=>{
                    con.release();
                    if(e){
                        console.error("db.getRoles(): ",e);
                        reject({code:1,msg:"Could not retrieve the list of roles"});
                    }
                    else{
                        resolve({code:0,msg:"Successfully",data:r});
                    }
                });
            }
        })
       
    })
}
//get client roles
exports.getClientRoles = (user_id)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(user_id).then(result=>{
            let user = result.data;
            var pool = getClientPool(user);
            var sql = "select * from roles order by level asc";
            pool.getConnection((e,con)=>{
                if(e){
                    console.error("db.getClientRoles(): ",e);
                    reject({code:1,msg:"Could not get connection to service",error:e});
                }
                else{
                    con.query(sql,(e,r)=>{
                        if(e){
                            console.error("db.getClientRoles(): ",e);
                            reject({code:1,msg:"Could not retrieve client roles",error:e});
                        }
                        else{
                            resolve({code:0,msg:"Successful",data:r})
                        }
                    });
                    con.release();
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
                var clientPool = getClientPool(user);
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
                        var clientPool = getClientPool(result.data);
                        clientPool.getConnection((e,conn)=>{
                            conn.release();
                            if(e){
                                console.error(getTimeStamp()+" db.deleteClientRole(): ",e);
                                reject({code:1,msg:"Could not connect to client space",error:e});
                            }
                            else{
                                conn.query("delete from roles where id=?",[role_id],(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.deleteClientRole(): ",e);
                                        reject({code:1,msg:"Could not connect to service",error:e});
                                    }
                                    else{
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
                var clientPool = getClientPool(result.data);
                clientPool.getConnection((e,conn)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.deleteClientRole(): ",e);
                        reject({code:1,msg:"Could not connect to client space",error:e});
                    }
                    else{
                        conn.query("update roles set name=?, description=?, level=? where id=?",[data.name,data.description,data.level,data.id],(e,r)=>{
                            conn.release();
                            if(e){
                                console.error(getTimeStamp()+" db.deleteClientRole(): ",e);
                                reject({code:1,msg:"Could not connect to service",error:e});
                            }
                            else{
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
//get payment terms
exports.getPaymentTerms = ()=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+" db.getpaymentTerms(): ",e);
                reject({code:1,msg:"Could not establish connection to service",error:e});
            }
            else{
                con.query("select * from payment_terms order by id asc",(e,r)=>{
                    con.release();
                    if(e){
                        console.error(getTimeStamp()+" db.getpaymentTerms(): ",e);
                        reject({code:1,msg:"Could not retrieve payment terms",error:e});
                    }
                    else{
                        resolve({code:0,msg:"success",data:r});
                    }
                })
            }
        })
    })
}

//get subscriptions
exports.getSubscriptionPackages = ()=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+" db.getSubscriptionPackages(): ",e);
                reject({code:1,msg:"Could not get connection to service",error:e});
            }
            else{
                con.query("select * from packages_tb",(e,r)=>{
                    con.release();
                    if(e){
                        console.console.error(getTimeStamp()+" db.getSubscriptionPackages(): ",e);
                        reject({code:1,msg:"Could not get subscription packages",error:e})
                    }
                    else resolve({code:0,msg:"Success",data:r}); 
                })
            }
        })
    })
}

//create subscription package
exports.createPackage = (package)=>{
    return new Promise((resolve,reject)=>{
        pool.getConnection((e,con)=>{
            if(e){
                console.error(getTimeStamp()+" db.createPackage(): ",e);
                reject({code:1,msg:"Could not get connection to service",error:e});
            }
            else{
                let sql = "insert into packages_tb (name,description,price,billing_term,features) values (?) on duplicate key update price=values(price),description=values(description),billing_term=values(billing_term),features=values(features)";
                let values = [package.name,package.description,package.price,package.billing_term,package.features];
                con.query(sql,[values],(e,r)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.createPackage(): ",e);
                        reject({code:1,msg:"Could not create package",error:e});
                    }
                    else{
                        con.release();
                        this.getSubscriptionPackages()
                        .then(result=>{
                            reject({code:0,msg:"Successful",data:result.data});
                        })
                        .catch(er=>{
                            console.error(getTimeStamp()+" db.createPackage(): ",er);
                            reject({code:1,msg:"Could not create package",error:er})
                        })
                    }
                })
            }
        })
    })
    
}

//create consignment
exports.createConsignment =(data)=>{
    var instructions_file = data.instructions_file;
    delete data.instructions_file;

    return new Promise((resolve,reject)=>{
        this.getUser(data.user).then(result=>{
            var userData = result.data;
            if(result.data){
                var clientPool = getClientPool(userData);
                clientPool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.createConsignment(): ",e);
                        reject({code:1,msg:"Could not get connection to service",error:e});
                    }
                    else{
                        var keys = Object.keys(data);
                        var values = Object.values(data);
                        //check if table exists
                        doesTableExist("consignments_tb",data.user)
                        .then(exists=>{
                            if(exists){
                                var insertSql = "insert into consignments_tb (";
                                keys.forEach((key)=>{
                                    insertSql += key +", ";
                                });
                                insertSql += "date_created, date_modified,status) values (?) ";
                                var now = Date.now();
                                values.push(now);
                                values.push(now);
                                values.push(1);
                                con.query(insertSql,[values],(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.createConsignment(): ",e);
                                        reject({code:1,msg:"Could not create consignment record",error:e});
                                    }
                                    else{
                                        con.release();
                                        if(r.insertId){
                                            //record successfully inserted
                                            if(instructions_file != null && instructions_file != undefined){
                                                //save file if provided
                                                saveFile(instructions_file,{user:data.user,target:'consignments_tb',refer_id:r.insertId,name:"shipping instructions",isUpdate:false})
                                                .then(fileId=>{
                                                    //consignment updated with file info
                                                    
                                                    this.getConsignments(data.user)
                                                    .then(result=>{
                                                        resolve({code:0,msg:"Successful",data:result.data});
                                                    })
                                                    .catch(err=>{
                                                        console.error(getTimeStamp()+" db.createConsignment(): ",err);
                                                        reject({code:1,msg:"Could not get consignments list",error:err});
                                                    })
                                                        
                                                })  
                                                .catch(notDone=>{
                                                    console.error(getTimeStamp()+" saveFile(): Could not save file");
                                                    reject({code:1,msg:"Could not save file",error:e});
                                                })
                                            }
                                            else{
                                                this.getConsignments(data.user)
                                                    .then(result=>{
                                                        resolve({code:0,msg:"Successful",data:result.data});
                                                    })
                                                    .catch(err=>{
                                                        console.error(getTimeStamp()+" db.createConsignment(): ",err);
                                                        reject({code:1,msg:"Could not get consignments list",error:err});
                                                    })
                                            }
                                        }
                                        else
                                        reject({code:1,msg:"No new record was created"});
                                    }
                                })
                            }
                            else{
                                //consignments table does not exist so we create
                                let sql = "create table if not exists consignments_tb (id int(10) auto_increment primary key, status int(2) default 1, date_created bigint, date_modified bigint, ";
                                keys.forEach((key,index)=>{
                                    sql += key;
                                    if(typeof(values[index]) == "string") {
                                        sql += " varchar(100) not null, ";
                                    }
                                    else {
                                        sql += " int(6) not null, ";
                                    }
                                    
                                });
                                sql += "consignee_name varchar(255), consignee_phone varchar(15), consignee_address varchar(255), consignee_tin varchar(20), notify_name varchar(255), notify_phone varchar(15), notify_address varchar(255), notify_tin varchar(20), exporter_id int(6), forwarder_id int(10), forwarder_code varchar(20)) ";
                                con.query(sql,(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.createConsignment(): ",e);
                                        reject({code:1,msg:"Could not create consignment table",error:e});
                                    }
                                    else{
                                        //successfully created consignment table so insert record
                                        var insertSql = "insert into consignments_tb (";
                                        keys.forEach((key)=>{
                                            insertSql += key +", ";
                                        });
                                        insertSql += "date_created, date_modified,status) values (?) ";
                                        var now = Date.now();
                                        values.push(now);
                                        values.push(now);
                                        values.push(1);
                                        con.query(insertSql,[values],(e,r)=>{
                                            if(e){
                                                console.error(getTimeStamp()+" db.createConsignment(): ",e);
                                                reject({code:1,msg:"Could not create consignment record",error:e});
                                            }
                                            else{
                                                if(r.insertId){
                                                    //record successfully inserted
                                                    if(instructions_file != null && instructions_file != undefined){
                                                        //save file if provided
                                                        saveFile(instructions_file,{user:data.user,target:'consignments_tb',refer_id:r.insertId,name:"shipping instructions",isUpdate:false})
                                                        .then(fileId=>{
                                                            
                                                            //consignment updated with file info
                                                            con.release();
                                                            this.getConsignments(data.user)
                                                            .then(result=>{
                                                                resolve({code:0,msg:"Successful",data:result.data});
                                                            })
                                                            .catch(err=>{
                                                                console.error(getTimeStamp()+" db.createConsignment(): ",err);
                                                                reject({code:1,msg:"Could not get consignments list",error:err});
                                                        
                                                            })
                                                                
                                                        })  
                                                        .catch(e=>{
                                                            console.error(getTimeStamp()+" saveFile(): Could not save file");
                                                            reject({code:1,msg:"Could not save file",error:e});
                                                        })
                                                    }
                                                    else{
                                                        this.getConsignments(data.user)
                                                        .then(result=>{
                                                            resolve({code:0,msg:"Successful",data:result.data});
                                                        })
                                                        .catch(err=>{
                                                            console.error(getTimeStamp()+" db.createConsignment(): ",err);
                                                            reject({code:1,msg:"Could not get consignments list",error:err});
                                                        })
                                                    }
                                                }
                                                else
                                                reject({code:1,msg:"No new record was created"});
                                            }
                                        })
                                    }
                                });
                                
                            }
                        })
                        .catch(e=>{
                            console.error(getTimeStamp()+" db.createConsignment(): ",e);
                            reject({code:1,msg:"Could not verify consignment table",error:e});
                        })                       
                    }
                })
            }
            else{
                console.error(getTimeStamp()+" db.createConsignment(): ",err);
                reject({code:1,msg:"You need to login to perform this operation",error:err});
           
            }
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.createConsignment(): ",e);
            reject(e);
        })
    })
    
}

//get all consignments for user
exports.getConsignments = (userId)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId)
        .then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                doesTableExist("consignments_tb",userId).then(exist=>{
                    pool.getConnection((e,con)=>{
                        if(e){
                            console.error(getTimeStamp()+" db.getConsignment(): ",e);
                            reject({code:1,msg:"Could not get connection to service",error:e});
                        }
                        else{
                            if(exist){
                                con.query("select * from consignments_tb order by id desc",(e,r)=>{
                                    con.release();
                                    con.destroy();
                                    if(e){
                                        console.error(getTimeStamp()+" db.getConsignment(): ",e);
                                        reject({code:1,msg:"Could not get consignments",error:e});
        
                                    }
                                    else{
                                        let consignments = r.map(i=>{
                                            i.status_text = CONSIGNMENT_STATUS.filter(s=>s.id == i.status)[0].status;
                                            return i;
                                        });
                                        this.getAllUserFiles(userId)
                                        .then(result=>{
                                            consginments = r.map(c=>{
                                                let i = c;
                                                i.files = result.data.filter(d=>d.refer_id == c.id);
                                                return i;
                                            });
                                            let consignmentsWithShipping = consignments;
                                            this.getBookings(userId)
                                            .then(result=>{
                                                consignmentsWithShipping = consignments.map(c=>{
                                                    let cs = c;
                                                    cs.shipping_details = result.data.filter(sd=>sd.cid == c.id)[0];
                                                    return cs;
                                                })
                                            })
                                            .catch(e=>{
                                                console.error(getTimeStamp()+" db.getConsignments(): ",e);
                                            })
                                            .finally(()=>{
                                                let newCons = consignmentsWithShipping;
                                                this.getContainers(userId).then(result=>{
                                                    newCons = consignmentsWithShipping.map(c=>{
                                                        let cs = c;
                                                        cs.container_details = result.data.filter(rs=>rs.cid == c.id)
                                                        return cs;
                                                    })
                                                })
                                                .catch(e=>{
                                                    console.error(getTimeStamp()+" db.getConsignments(): ",e);
                                                })
                                                .finally(()=>{
                                                    resolve({code:0,"msg":"successful",data:newCons});
                                                })
                                            })
                                        }).catch(e=>{
                                            console.error(getTimeStamp()+" db.getConsignments(): ",e);
                                            reject({code:1,msg:"Could not get consignment fiels",error:e});
                                        })
                                       
                                    }
                                })
                            }
                            else{
                                let sql = "create table if not exists consignments_tb (id int(10) auto_increment primary key, status int(2) default 1, date_created bigint, date_modified bigint, cargo_classification varchar(100),place_of_destination varchar(100), place_of_delivery varchar(100),port_of_discharge varchar(100),port_of_origin varchar(100),";
                                sql += "no_of_containers varchar(100), goods_description varchar(100), no_of_packages varchar(100),package_unit varchar(100),gross_weight varchar(100),gross_weight_unit varchar(100),gross_volume varchar(100), gross_volume_unit varchar(100),net_weight varchar(100),net_weight_unit varchar(100), invoice_value varchar(100), invoice_currency varchar(100),freight_charge varchar(100),freight_currency varchar(100),imdg_code varchar(100),packing_type varchar(100),oil_type varchar(100),shipping_mark varchar(100),user int(10) not null,";
                                sql += "consignee_name varchar(255), consignee_phone varchar(15), consignee_address varchar(255), consignee_tin varchar(20), notify_name varchar(255), notify_phone varchar(15), notify_address varchar(255), notify_tin varchar(20), exporter_id int(6), forwarder_id int(10), forwarder_code varchar(20)) ";
                                con.query(sql,(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.createConsignment(): ",e);
                                        reject({code:1,msg:"Could not create consignment table",error:e});
                                    }
                                    else{
                                        resolve({code:0,"msg":"successful",data:newCons});
                                    }
                                    con.release();
                                    con.destroy();
                                })
                            }
                        }
                    })
                
                }).catch(e=>{
                    console.error(getTimeStamp()+" db.getConsignments() :",e);
                reject({code:1,msg:"Could not verify if consignment table exists",error:e})
                })
            }
            else{
                console.error(getTimeStamp()+" db.getConsignments() :",result.data);
                reject({code:1,msg:"Invalid user"})
            }
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.getConsignments() :",e);
            reject({code:1,msg:"You need to login",error:e})
        })
    })
}

//get single consignment
exports.getConsignment = (userId,cid)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId)
        .then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                pool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.createConsignment(): ",e);
                        reject({code:1,msg:"Could not get connection to service",error:e});
                    }
                    else{
                        con.query("select * from consignments_tb  where id=? order by id desc",[cid],(e,r)=>{
                            con.release();
                            if(e){
                                console.error(getTimeStamp()+" db.createConsignment(): ",e);
                                reject({code:1,msg:"Could not get connection to service",error:e});

                            }
                            else{
                                let consignments = r.map(i=>{
                                    i.status_text = CONSIGNMENT_STATUS.filter(s=>s.id == i.id)[0].status;
                                    return i;
                                });
                                this.getAllUserFiles(userId)
                                .then(result=>{
                                    consginments = r.map(c=>{
                                        let i = c;
                                        i.files = result.data.filter(d=>d.refer_id == c.id);
                                        return i;
                                    });
                                    let consignmentsWithShipping = consignments;
                                    this.getBookings(userId)
                                    .then(result=>{
                                        consignmentsWithShipping = consignments.map(c=>{
                                            let cs = c;
                                            cs.shipping_details = result.data.filter(sd=>sd.cid == c.id)[0];
                                            return cs;
                                        })
                                    })
                                    .catch(e=>{
                                        console.error(getTimeStamp()+" db.getConsignments(): ",e);
                                    })
                                    .finally(()=>{
                                        let newCons = consignmentsWithShipping;
                                        this.getContainers(userId).then(result=>{
                                            newCons = consignmentsWithShipping.map(c=>{
                                                let cs = c;
                                                cs.container_details = result.data.filter(rs=>rs.cid == c.id)
                                                return cs;
                                            })
                                        })
                                        .catch(e=>{
                                            console.error(getTimeStamp()+" db.getConsignments(): ",e);
                                        })
                                        .finally(()=>{
                                            resolve({code:0,"msg":"successful",data:newCons});
                                        })
                                    })
                                }).catch(e=>{
                                    console.error(getTimeStamp()+" db.getConsignments(): ",e);
                                    reject({code:1,msg:"Could not get consignment fiels",error:e});
                                })
                               
                            }
                        })
                    }
                })
            }
            else{
                console.error(getTimeStamp()+" db.getConsignments() :",result.data);
                reject({code:1,msg:"Invalid user"})
            }
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.getConsignments() :",e);
            reject({code:1,msg:"You need to login",error:e})
        })
    })
}

//update consignment file
exports.updateConsignmentFile = (data)=>{
    return new Promise((resolve,reject)=>{
        if(data.file){
            this.getConsignment(data.user,data.cid)
            .then(result=>{
                if(result.data){
                    var consignment = result.data[0];
                    var option = {target:data.target,user:data.user,refer_id:data.cid,name:data.name,isUpdate:false};
                    var files = consignment.files.filter(f=>f.refer_id == consignment.id && f.name == data.name);
                    if(files && files.length > 0){
                        option.filename = files[0].filename;
                        option.isUpdate = true;
                    }
                    saveFile(data.file,option)
                    .then(done=>{
                        if(done){
                            let status = parseInt(consignment.status);
                            if(option.name == "container booking" && consignment.status <= 4) status = 5;
                            else if(option.name == "container booking" && consignment.status > 4) status = consignment.status;
                            else if(option.name == "ship booking" && consignment.status <= 2) status = 3;
                            else if(option.name == "ship booking" && consignment.status > 2) status = consignment.status;
                            else if(option.name == "shipping instructions" && consignment.status <= 1) status = 2;
                            else if(option.name == "shipping instructions" && consignment.status >1) status = consignment.status;
                            else if(option.name.includes("ODG Certificate") && consignment.status <= 3) status = 4;
                            else if(option.name.includes("ODG Certificate") && consignment.status > 3) status = consignment.status;
                            else if(option.name =="custom release" && consignment.status <= 5) status = 6;
                            else if(option.name =="custom release" && consignment.status > 5) status = consignment.status;
                            else if(option.name =="loading permission" && consignment.status <= 6) status = 7;
                            else if(option.name =="loading permission" && consignment.status > 6) status = consignment.status;
                            else if(option.name =="export permission" && consignment.status <= 7) status = 8;
                            else if(option.name =="export permission" && consignment.status > 7) status = consignment.status;
                            else if(option.name =="screening report" && consignment.status <= 8) status = 9;
                            else if(option.name =="screening report" && consignment.status > 8) status = consignment.status;
                            else if(option.name =="bill of lading" && consignment.status <= 9) status = 10;
                            else if(option.name =="bill of lading" && consignment.status > 9) status = consignment.status;
                            this.updateConsignmentStatus(data.user,status,data.cid)
                            .then(result=>{
                                resolve(result);
                            })
                            .catch(e=>{
                                reject(e);
                            })
                        }
                        else{
                            reject({code:1,msg:"Could not save file"});
                        }
                        
                    })
                    .catch(e=>{
                        console.error(getTimeStamp()+" db.updateConsignmentFiles(): ",e);
                        reject(e);
                    })
                }
                else{
                    console.error(getTimeStamp()+" db.updateConsignmentFiles(): ");
                    reject({code:1,msg:"Could not find consignment"});
                }
            })
            .catch(e=>{
                console.error(getTimeStamp()+" db.updateConsignmentFiles(): ",e);
                reject({code:1,msg:"Could not find consignment",error:e});
            })
           
        }
        else{
            reject({code:1,msg:"Invalid file"})
        }
    })
    
}
//create consignment
exports.updateConsignment =(data)=>{
    var consId = data.id;
    var userId = data.user;
    var instructions_file = data.instructions_file;
    delete data.id;
    delete data.user;
    delete data.instructions_file;
    console.log("data: ",data);
    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            var userData = result.data;
            if(userData){
                var clientPool = getClientPool(userData);
                clientPool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.updateConsignment(): ",e);
                        reject({code:1,msg:"Could not get connection to service",error:e});
                    }
                    else{
                        if(instructions_file != null){
                            saveFile(instructions_file,{user:userId,target:'consignments_tb',refer_id:consId,name:"shipping instructions",isUpdate:true})
                            .then(fileId=>{
                                // data.instructions_file = fileId; 
                                var updateSql = "update consignments_tb set ";
                                var now = Date.now();
                                var keys = Object.keys(data);
                                var values = Object.values(data);
                                keys.forEach((key,index)=>{
                                    if(index < keys.length -1){
                                        updateSql += key +"=?, ";
                                        
                                    }
                                    else{
                                        updateSql += key+"=?, date_modified=? where id=?";
                                                
                                    }
                                });
                                values.push(now);
                                values.push(consId);
                                con.query(updateSql,values,(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.updateConsignment(): ",e);
                                        reject({code:1,msg:"Could not update consignment record",error:e});
                                    }
                                    else{
                                        con.release();
                                        this.getConsignments(userId)
                                        .then(result=>{
                                            resolve({code:0,msg:"Successful",data:result.data});
                                        })
                                        .catch(err=>{
                                            console.error(getTimeStamp()+" db.updateConsignment(): ",err);
                                            reject({code:1,msg:"Could not get consignments list",error:err});
                                        })
                                        
                                    }
                                })
                            })
                            .catch(notDone=>{
                                console.error(getTimeStamp()+" saveFile(): Could not save file");
                                reject({code:1,msg:"Could not save file"});
                            })
                           
                        }
                        else{
                            var updateSql = "update consignments_tb set ";
                            var now = Date.now();
                            var keys = Object.keys(data);
                            var values = Object.values(data);
                            keys.forEach((key,index)=>{
                                if(index < keys.length -1){
                                    updateSql += key +"=?, ";
                                    
                                }
                                else{
                                    updateSql += key+"=?, date_modified=? where id=?";
                                            
                                }
                            });
                            values.push(now);
                            values.push(consId);
                            con.query(updateSql,values,(e,r)=>{
                                if(e){
                                    console.error(getTimeStamp()+" db.updateConsignment(): ",e);
                                    reject({code:1,msg:"Could not update consignment record",error:e});
                                }
                                else{
                                    con.release();
                                    this.getConsignments(userId)
                                    .then(result=>{
                                        resolve({code:0,msg:"Successful",data:result.data});
                                    })
                                    .catch(err=>{
                                        console.error(getTimeStamp()+" db.updateConsignment(): ",err);
                                        reject({code:1,msg:"Could not get consignments list",error:err});
                                    })
                                    
                                }
                            })
                        }
                    }
                })
            }
            else{
                console.error(getTimeStamp()+" db.updateConsignment(): ",e);
                reject({code:1,msg:"You need to login to perform this operation",error:e});
        
            }
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.updateConsignment(): ",e);
            reject({code:1,msg:"You need to login to perform this operation",error:e});
        })
    })
    
}
//update consignment status
exports.updateConsignmentStatus = (userId,status,cid)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId)
        .then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                this.getConsignment(userId,cid).then(result=>{
                    if(result.data){
                        if(result.data.status >= status){
                            this.getConsignments(userId)
                                .then(result=>{
                                    resolve(result);
                                })
                                .catch(e=>{
                                    reject(e);
                                })
                        }
                        else{
                            pool.getConnection((e,con)=>{
                                if(e){
                                    console.error(getTimeStamp()+" db.updateConsignmentStatus(): ",e);
                                    reject({code:1,msg:"Could not get connection to service",error:e});
                                }
                                else{
                                    var sql = "update consignments_tb set status=?,date_modified=? where id=?";
                                    var values = [status,Date.now(),cid];
                
                                    con.query(sql,values,(e,r)=>{
                                        if(e){
                                            console.error(getTimeStamp()+" db.updateConsignmentStatus(): ",e);
                                            reject({code:1,msg:"Could not update consignment",error:e});
                                        }
                                        else{
                                            con.release();
                                            this.getConsignments(userId)
                                            .then(result=>{
                                                resolve(result);
                                            })
                                            .catch(e=>{
                                                reject(e);
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    }
                    else{
                        reject({code:1,msg:"Invalid consignment"});
                    }
                })
               
            }
            else{
                reject({code:1,msg:"Invalid user"});
            }
        }).catch(e=>{
            console.error(getTimeStamp()+" db.updateConsignmentStatus(): ",e);
            reject({code:1,msg:"Could not verify user credentials",error:e});
        })
    })
   
}
//get consignment files
exports.getUserFiles = (refId,userId)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                pool.query("select * from user_files where refer_id=?",[refId],(e,r)=>{
                    resolve({code:0,msg:"Successful",data:r});
                })
            }
        }).catch(e=>{
            console.error(getTimeStamp()+" db.getUserFiles(): ",e);
            reject({code:1,msg:"You need to login with a valid account",error:e});
        })
    })
}
//get all consignment files
exports.getAllUserFiles = (userId)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                doesTableExist("user_files",userId)
                .then(exist=>{
                    if(exist){
                        pool.getConnection((e,con)=>{
                            if(e){
                                console.error(getTimeStamp()+" db.getUserFiles(): ",e);
                                reject({code:1,msg:"Could not get connection to service",error:e});
                            }
                            else{
                                con.query("select * from user_files",(e,r)=>{
                                    con.release();
                                    if(e){
                                        console.error(getTimeStamp()+" db.getUserFiles(): ",e);
                                        reject({code:1,msg:"Could not get consignment files",error:e});
                                    }
                                    else{
                                        resolve({code:0,msg:"Successful",data:r});
                                    }
                                })
                            }
                        })
                    }
                    else{
                        resolve({code:0,msg:"Successful",data:[]}); 
                    }
                    
                })
                .catch(e=>{
                    console.error(getTimeStamp()+" db.getUserFiles(): ",e);
                    reject({code:1,msg:"Could not verify user files",error:e});
                })
            }
            else{
                console.error(getTimeStamp()+" db.getUserFiles(): ");
                reject({code:1,msg:"You need to login with a valid account"});
            }
        }).catch(e=>{
            console.error(getTimeStamp()+" db.getUserFiles(): ",e);
            reject({code:1,msg:"You need to login with a valid account",error:e});
        })
    })
}

//create booking
exports.createBooking=(data)=>{
    return new Promise((resolve,reject)=>{
        var userId = data.user_id;
        var bookingConfirmation = data.booking_confirmation;
        delete data.user_id;
        delete data.booking_confirmation;
        this.getUser(userId).then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                pool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.createBooking(): ",e);
                        reject({code:1,msg:"Could not get connection to service",error:e});
                    }
                    else{
                        doesTableExist("ship_bookings",userId)
                        .then(exist=>{
                            var keys = Object.keys(data);
                            var values = Object.values(data);
                            if(exist){
                                var sql = "insert into ship_bookings (";
                                
                                keys.forEach(key=>{
                                   sql += key+", "
                                })
                                sql += "date_created) values(?) on duplicate key update vessel_name=values(vessel_name),shipping_line=values(shipping_line),mbl_number=values(mbl_number), bl_type=values(bl_type),booking_no=values(booking_no)";
                                values.push(Date.now());
                                con.query(sql,[values],(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.createBooking(): ",e);
                                        reject({code:1,msg:"Could not update record",error:e});
                                
                                    }
                                    else{
                                        con.release();
                                        if(bookingConfirmation != null){
                                            saveFile(bookingConfirmation,{user:userId,
                                                target:"ship_bookings",name:"ship booking",refer_id:data.cid,isUpdate:false})
                                            .then(done=>{
                                                if(done){
                                                    this.updateConsignmentStatus(userId,3,data.cid)
                                                    .then(rs=>{
                                                        resolve({code:0,msg:"successful",data:rs.data});
                                                    })
                                                    .catch(e=>{
                                                        resolve(result);
                                                    })
                                                }
                                                else{
                                                    this.getConsignments(userId)
                                                    .then(rs=>{
                                                        resolve({code:0,msg:"successful",data:rs.data});
                                                    })
                                                    .catch(e=>{
                                                        resolve(result);
                                                    })
                                                }
                                                
                                            })
                                            .catch(e=>{
                                                reject(e);
                                            })
                                            
                                        }
                                        else{
                                            this.getConsignments(userId)
                                            .then(rs=>{
                                                resolve({code:0,msg:"successful",data:rs.data});
                                            })
                                            .catch(e=>{
                                                resolve(result);
                                            })
                                        }
                                    }
                                })
                                
                            }
                            else{
                                var createSql = "create table ship_bookings (";
                                keys.forEach(key=>{
                                    if(key.toLowerCase() == "cid") createSql += key+ " int(10) not null unique, ";
                                    else if(key.toLowerCase() == "terminal_carry_date" || key.toLowerCase() == "etd" || key.toLowerCase() == "etb" || key.toLowerCase() == "eta") createSql += key+" bigint, ";
                                    else createSql += key +" varchar(50), ";
                                });
                                createSql += "date_created bigint,date_modified bigint)";
                                con.query(createSql,(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.createBooking(): ",e);
                                        reject({code:1,msg:"Could not create shipping table",error:e});
                                    }
                                    else{
                                        var sql = "insert into ship_bookings (";
                                
                                        keys.forEach(key=>{
                                           sql += key+", "
                                        })
                                        sql += "date_created bigint,date_modified) values(?) on duplicate key update vessel_name=values(vessel_name),shipping_line=values(shipping_line),mbl_number-values(mbl_number), bl_type=values(bl_type),booking_no=values(booking_no)";
                                        values.push(Date.now());
                                        values.push(Date.now());
                                        con.query(sql,[values],(e,r)=>{
                                            if(e){
                                                console.error(getTimeStamp()+" db.createBooking(): ",e);
                                                reject({code:1,msg:"Could not update record",error:e});
                                        
                                            }
                                            else{
                                                if(bookingConfirmation != null){
                                                    saveFile(bookingConfirmation,{user:userId,target:"ship_bookings",name:"booking confirmation",refer_id:data.cid,isUpdate:false})
                                                    .then(fileId=>{
                                                        this.getBookings(userId)
                                                        .then(result=>{
                                                            con.release();
                                                            this.updateConsignmentStatus(userId,3,data.cid)
                                                            .then(rs=>{
                                                                resolve({code:0,msg:"successful",data:rs.data});
                                                            })
                                                            .catch(e=>{
                                                                console.error(getTimeStamp()+" db.createBooking(): ",e);
                                                                reject({code:1,msg:"Could not update consignment status",error:e});
                                                            })
                                                        })
                                                        .catch(e=>{
                                                            reject(e);
                                                        })
                                                    })
                                                    .catch(e=>{
                                                        reject(e);
                                                    })
                                                    
                                                }
                                                else{
                                                    con.release();
                                                    this.getConsignments(userId)
                                                    .then(rs=>{
                                                        resolve({code:0,msg:"successful",data:rs.data});
                                                    })
                                                    .catch(e=>{
                                                        resolve(result);
                                                    })
                                                       
                                                }
                                            }
                                        }) 
                                    }
                                })
                            }
                        })
                        .catch(e=>{
                            console.error(getTimeStamp()+" db.createBooking(): ",e);
                            reject({code:1,msg:"Could not verify table",error:e});
                        })
                    }
                })
            }
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.createBooking(): ",e);
            reject({code:1,msg:"You must be logged in to access this resource",error:e});
        })
    })
   
}
//update booking
exports.updateBooking=(data)=>{
    var userId = data.user_id;
    var file= data.booking_confirmation;
    var bid = data.id;
    delete data.user_id;
    delete data.id;
    delete data.booking_confirmation;

    return new Promise((resolve,reject)=>{
        this.getUser(userId)
        .then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                var sql = "update ship_bookings set ";
                var keys = Object.keys(data);
                var values = Object.values(data);

                keys.forEach(key=>{
                    sql += key +"=?, ";
                });
                sql += "date_modified=? where id=?";
                values.push(Date.now());
                values.push(bid);
                if(file != null && file != undefined){
                    saveFile(file,{user:userId,refer_id:data.cid,name:"ship booking",target:"ship_bookings",isUpdate:true})
                    .then(fileId=>{
                        console.log("saved file: ",fileId);
                        pool.getConnection((e,con)=>{
                            if(e){
                                console.error(getTimeStamp()+" db.updateBooking(): ",e);
                                reject({code:1,msg:"Could not save file",error:e});
                            }
                            else{
                                con.query(sql,values,(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.updateBooking(): ",e);
                                        reject({code:1,msg:"Could not save file",error:e});
                                    }
                                    else{
                                        console.log("update query: ",r);
                                        con.release();
                                        this.updateConsignmentStatus(userId,3,data.cid)
                                            .then(rs=>{
                                                resolve({code:0,msg:"successful",data:rs.data});
                                            })
                                            .catch(e=>{
                                                console.error(getTimeStamp()+" db.updateBooking(): ",e);
                                                reject({code:1,msg:"Could not update consignment status",error:e});
                                            })
                                       
                                    }
                                })
                            }
                        })
                    })
                    .catch(e=>{
                        console.error(getTimeStamp()+" db.updateBooking()2: ",e);
                        reject({code:1,msg:"Could not save file",error:e});
                    })
                }
                else{
                    pool.getConnection((e,con)=>{
                        if(e){
                            console.error(getTimeStamp()+" db.updateBooking(): ",e);
                            reject({code:1,msg:"Could not save file",error:e});
                        }
                        else{
                            con.query(sql,values,(e,r)=>{
                                if(e){
                                    console.error(getTimeStamp()+" db.updateBooking(): ",e);
                                    reject({code:1,msg:"Could not save file",error:e});
                                }
                                else{
                                    con.release();
                                    this.getBookings(userId)
                                    .then(result=>{
                                        this.getConsignments(userId)
                                            .then(rs=>{
                                                resolve({code:0,msg:"successful",data:rs.data});
                                            })
                                            .catch(e=>{
                                                console.error(getTimeStamp()+" db.updateBooking(): ",e);
                                                reject({code:1,msg:"Could not get consignment list",error:e});
                                            })
                                    })
                                    .catch(e=>{
                                        console.error(getTimeStamp()+" db.updateBooking(): ",e);
                                        reject({code:1,msg:"Could not update record",error:e});
                                    })
                                }
                            })
                        }
                    })
                }
            }
            else{
                console.error(getTimeStamp()+" db.updateBooking(): ","Invalid user");
                reject({code:1,msg:"Invalid user"});
            }
        })
        .catch(er=>{
            console.error(getTimeStamp()+" db.updateBooking(): ",er);
            reject({code:1,msg:"Could not verify user credentials",error:er});
        })
    })

}
//get bookings
exports.getBookings = (userId)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId)
        .then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                var sql = "select * from ship_bookings";
                pool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.getBookings(): ",e);
                        reject({code:1,msg:"Could not get connection to service",error:e}); 
                    }
                    else{
                        doesTableExist("ship_bookings",userId).then(exist=>{
                            if(exist){
                                con.query(sql,(e,r)=>{
                                    if(e){
                                        console.error(getTimeStamp()+" db.createBooking(): ",e);
                                        reject({code:1,msg:"Could not get bookings",error:e});
                                    }
                                    else{
                                        con.release();
                                        resolve({code:0,msg:"successful",data:r});
                                    }
                                })
                            }
                            else{
                                con.release();
                                resolve({code:0,msg:"successful",data:[]});
                            }
                        })
                        .catch(e=>{
                            console.error(getTimeStamp()+" db.getBookings(): ",e);
                            reject({code:1,msg:"Could not verify ship bookings table",error:e});
                        })
                    }
                })
            }
            else{
                console.error(getTimeStamp()+" db.getBookings(): ",e);
                reject({code:1,msg:"You must be logged in to access this resource",error:e});
            }
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.getBookings(): ",e);
            reject({code:1,msg:"Invalid user",error:e});
        })
    })
   
}

//create container
exports.createContainer = (userId,data)=>{
    
    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                //check if table exists
                doesTableExist("container_bookings",userId)
                .then(exist=>{
                    pool.getConnection((e,con)=>{
                        if(e){
                            console.error(getTimeStamp()+" db.createContainer(): ",e);
                            reject({code:1,msg:"Could not get connection to service",error:e});
                        }
                        else{
                            con.beginTransaction((e)=>{
                                if(e){
                                    con.release();
                                    console.error(getTimeStamp()+" db.createContainer(): ",e);
                                    reject({code:1,msg:"Something went wrong. Please try again later",error:e});
                                }
                                else{
                                    data.forEach(d=>{
                                        var insertSql = (d.id == -1) ? "insert into container_bookings (" : "update container_bookings set ";
                                        var keys = Object.keys(d);
                                        var values = Object.values(d);
                                        keys.forEach(key=>{
                                            insertSql += (d.id == -1) ? key +", " : key +"=?, ";
                                        });
                                        insertSql += (d.id == -1) ? "date_modified) values (?)" : "date_modified=? where id=?";
                                        values.push(Date.now());
                                        if(d.id > 0) {
                                            values.push(d.id);
                                        }
                                        else values = [values];
                                        if(exist){
                                            con.query(insertSql,values,(e,r)=>{
                                                if(e){
                                                    console.error(getTimeStamp()+" db.createContainer(): ",e);
                                                    reject({code:1,msg:"Could not create new record",error:e});
                                                }
                                                else{
                                                    if(con.commit()){
                                                        // con.release();
                                                        this.getConsignments(userId)
                                                            .then(result=>{
                                                                resolve(result);
                                                            }).catch(e=>{
                                                                reject(e);
                                                            })
                                                    }
                                                    else{
                                                        con.rollback((e)=>{
                                                            con.release();
                                                            if(e){
                                                                console.error(getTimeStamp()+" db.createContainer(): ",e);
                                                                reject({code:1,msg:"Somthing went wrong! Please try again later",error:e});
                                                            }
                                                        })
                                                    }
                                                    
                                                }
                                            })
                                        }
                                        else{
                                            var createSql = "create table container_bookings (id int(10) auto_increment primary key, cid int(10) not null, mbl_number varchar(50), container_type varchar(50) not null, container_no varchar(50) not null, container_size varchar(10) not null, ";
                                            createSql += "seal_1 varchar(50), seal_2 varchar(50), seal_3 varchar(50), freight_indicator varchar(50), no_of_packages int(4), package_unit varchar(50), volume varchar(5), volume_unit varchar(50), weight varchar(10) not null, weight_unit varchar(50), ";
                                            createSql += "max_temp varchar(5), min_temp varchar(50), plug_yn varchar(50) not null, date_modified bigint)";
                                            con.query(createSql,(e,r)=>{
                                                if(e){
                                                        console.error(getTimeStamp()+" db.createContainer(): ",e);
                                                        reject({code:1,msg:"Could not create container table",error:e});
                                                }
                                                else{
                                                    con.query(insertSql,[values],(e,r)=>{
                                                        if(e){
                                                            console.error(getTimeStamp()+" db.createContainer(): ",e);
                                                            reject({code:1,msg:"Could not create new record",error:e});
                                                        }
                                                        else{
                                                            con.release();
                                                            this.getConsignments(userId)
                                                                .then(result=>{
                                                                    resolve(result);
                                                                }).catch(e=>{
                                                                    reject(e);
                                                                })
                                                            
                                                        }
                                                    }) 
                                                }
                                            })
                                        }
                                    });
                                    // con.release();
                                }
                            })
                            
                            
                        }
                    })
                    
                })
                
            }
            else{
                console.error(getTimeStamp()+" db.createContainer(): ",result);
                reject({code:1,msg:"Failed to verify user credentials"})
            }
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.createContainer(): ",e);
            reject(e);
        })
    })
}
exports.updateContainer = (data)=>{
    var userId = data.user;
    var containerId = data.id;
    var file = data.container_file;
    delete data.user;
    delete data.id;
    delete data.container_file;

    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            if(result.data){
                var pool = getClientPool(result.data);
                var keys = Object.keys(data);
                var values = Object.values(data);
                var sql = "update container_bookings set ";
                keys.forEach(key=>{
                    sql += key+"=? ,";
                });
                sql += "date_modified=? where id=? ";
                values.push(Date.now());
                values.push(containerId);
                pool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.updateContainer(): ",e);
                        reject({code:1,msg:"Could not get connection to service",error:e})
                    }
                    else{
                        con.query(sql,values,(e,r)=>{
                            con.release();
                            if(e){
                                console.error(getTimeStamp()+" db.updateContainer(): ",e);
                                reject({code:1,msg:"Could not update container data",error:e}) 
                            }
                            else{
                                if(file != null && file != undefined){
                                    saveFile(file,{user:userId,target:"container_bookings",refer_id:data.cid,name:"container booking",isUpdate:true})
                                    .then(done=>{
                                        if(done){
                                            this.updateConsignmentStatus(userId,4,data.cid)
                                            .then(result=>{
                                                resolve(result);
                                            })
                                            .catch(e=>{
                                                reject(e);
                                            })
                                        }
                                        else{
                                            this.getConsignments(userId)
                                            .then(result=>{
                                                resolve(result);
                                            })
                                            .catch(e=>{
                                                reject(e);
                                            })
                                        }
                                    })
                                    .catch(e=>{
                                        reject(e);
                                    })
                                }
                                else{
                                    this.getConsignments(userId)
                                    .then(result=>{
                                        resolve(result);
                                    })
                                    .catch(e=>{
                                        reject(e);
                                    })
                                }
                            }
                        })
                    }
                })
            }
            else{
                console.error(getTimeStamp()+" db.updateContainer(): No user");
                reject({code:1,msg:"You need to permission to access this resource"});
            }
        })
        .catch(e=>{
            reject(e);
        })
    })
}
//get containers
exports.getContainers = (userId)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            var pool = getClientPool(result.data);
            
            doesTableExist("container_bookings",userId).then(exist=>{
                pool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.getContainers(): ",e);
                        reject({code:1,msg:"Could not get connection to service",error:e});
                    }
                    else{
                        con.release();
                        if(exist){
                            con.query("select * from container_bookings",(e,r)=>{
                                if(e){
                                    console.error(getTimeStamp()+" db.getContainers(): ",e);
                                    reject({code:1,msg:"Could not retrieve container data",error:e});
                                }
                                else{
                                    resolve({code:0,msg:"successful",data:r});
                                }
                            })
                        }
                        else{
                            resolve({code:0,msg:"successful",data:[]});
                        }
                    }
                })
            })
            .catch(e=>{
                reject({code:1,msg:"Could not verify container table",error:e});
            })
                    
          
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.getContainers(): ",e);
            reject(e)
        })
    })
}

//create quotation
exports.createQuotation = (userId,data)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            var pool = getClientPool(result.data);
            doesTableExist("quotations",userId)
                .then(exist=>{
                    var keys = Object.keys(data);
                    var values = Object.values(data);
                    if(exist){
                        var sql = "insert into quotations (";
                        
                        keys.forEach(key=>{
                            sql += key+", "
                        })
                        sql += "date_created,date_modified) values(?) ";
                        values.push(Date.now());
                        values.push(Date.now());
                        pool.getConnection((e,con)=>{
                            if(e){
                                console.error(getTimeStamp()+" db.createQuotation(): ",e);
                                reject({code:1,msg:"Could not get connection to service",error:e});
                            }
                            else{
                                con.beginTransaction((e)=>{
                                    if(e){
                                        con.destroy();
                                    }
                                    else{
                                        con.query(sql,[values],(e,r)=>{
                                            if(e){
                                                console.error(getTimeStamp()+" db.createQuotation(): ",e);
                                                reject({code:1,msg:"Could not create record",error:e});
                                                con.destroy()
                                            }
                                            else{
                                                if(con.commit()){
                                                    con.release();
                                                    this.getQuotations(userId)
                                                    .then(rs=>{
                                                        resolve({code:0,msg:"successful",data:rs.data});
                                                    })
                                                    .catch(e=>{
                                                        reject({code:1,msg:"Could not retrieve updated list of consignments",error:e});
                                                    })
                                                }
                                                else{
                                                    con.rollback((e)=>{
                                                        con.destroy();
                                                        reject({code:1,msg:"Could not create record",error:e})
                                                    })
                                                    
                                                }
                                                
                                            }
                                        })
                                    }
                                })
                            }
                        })
                        
                        
                    }
                    else{
                        var createSql = "create table quotations (id int(10) auto_increment primary key, ";
                        keys.forEach(key=>{
                            if(key.toLowerCase() == "quantity") createSql += key+ " int(5), ";
                            else if(key.toLowerCase() == "customer_id") createSql += key+" int(10), ";
                            else createSql += key +" varchar(100), ";
                        });
                        createSql += "date_created bigint,date_modified bigint)";
                        pool.getConnection((e,con)=>{
                            if(e){
                                console.error(getTimeStamp()+" db.createQuotation(): ",e);
                                reject({code:1,msg:"Could not get connection to service",error:e});
                            }
                            else{
                                con.beginTransaction((e)=>{
                                    if(e){
                                        con.destroy();
                                    }
                                    else{
                                        con.query(createSql,(e,r)=>{
                                            if(e){
                                                console.error(getTimeStamp()+" db.createBooking(): ",e);
                                                reject({code:1,msg:"Could not create shipping table",error:e});
                                            }
                                            else{
                                                var sql = "insert into quotations (";
                                        
                                                keys.forEach(key=>{
                                                sql += key+", "
                                                })
                                                sql += "date_created,date_modified) values(?) ";
                                                values.push(Date.now());
                                                values.push(Date.now());
                                                
                                                con.query(sql,[values],(e,r)=>{
                                                    if(e){
                                                        console.error(getTimeStamp()+" db.createQuotation(): ",e);
                                                        reject({code:1,msg:"Could not create record",error:e});
                                                        con.destroy()
                                                    }
                                                    else{
                                                        if(con.commit()){
                                                            con.release();
                                                            this.getQuotations(userId)
                                                            .then(rs=>{
                                                                resolve({code:0,msg:"successful",data:rs.data});
                                                            })
                                                            .catch(e=>{
                                                                resolve(result);
                                                            })
                                                        }
                                                        else{
                                                            con.rollback((e)=>{
                                                                con.destroy();
                                                                reject({code:1,msg:"Could not create record",error:e})
                                                            })
                                                            
                                                        }
                                                        
                                                    }
                                                })
                                                
                                            }
                                        })
                                    }
                                });
                            }
                        })
                    }
                })
                .catch(e=>{
                    console.error(getTimeStamp()+" db.createQuotation(): ",e);
                    reject({code:1,msg:"Could not verify table",error:e});
                })
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.createQuotation(): ",e);
            reject({code:1,msg:"You must be logged in to access this resource",error:e});
        })
    })
   
}

//update quotation
exports.updateQuotation = (userId,data)=>{
    var customerId = data.id;
    delete data.id;
    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            var pool = getClientPool(result.data);
            var keys = Object.keys(data);
            var values = Object.values(data);
            
            var sql = "update quotations set ";
            
            keys.forEach(key=>{
                sql += key+"=?, ";
            })
            sql += "date_modified=? where id=?";
            values.push(Date.now());
            values.push(customerId);
            pool.getConnection((e,con)=>{
                if(e){
                    console.error(getTimeStamp()+" db.upateQuotation(): ",e);
                    reject({code:1,msg:"Could not get connection to service",error:e});
                }
                else{
                    con.beginTransaction((e)=>{
                        if(e){
                            con.destroy();
                        }
                        else{
                            con.query(sql,values,(e,r)=>{
                                if(e){
                                    console.error(getTimeStamp()+" db.updateQuotation(): ",e);
                                    reject({code:1,msg:"Could not update record",error:e});
                                    con.destroy()
                                }
                                else{
                                    if(con.commit()){
                                        con.release();
                                        this.getQuotations(userId)
                                        .then(rs=>{
                                            resolve({code:0,msg:"successful",data:rs.data});
                                        })
                                        .catch(e=>{
                                            reject({code:1,msg:"Could not retrieve updated list of consignments",error:e});
                                        })
                                    }
                                    else{
                                        con.rollback((e)=>{
                                            con.destroy();
                                            reject({code:1,msg:"Could not create record",error:e})
                                        })
                                        
                                    }
                                    
                                }
                            })
                        }
                    })
                }
            })
             
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.createQuotation(): ",e);
            reject({code:1,msg:"You must be logged in to access this resource",error:e});
        })
    })
   
}

//get quotation
exports.getQuotations = (userId)=>{
    return new Promise((resolve,reject)=>{
        this.getUser(userId).then(result=>{
            var pool = getClientPool(result.data);
            
            doesTableExist("quotations",userId).then(exist=>{
                pool.getConnection((e,con)=>{
                    if(e){
                        console.error(getTimeStamp()+" db.getQuotations(): ",e);
                        reject({code:1,msg:"Could not get connection to service",error:e});
                    }
                    else{
                        if(exist){
                            con.query("select * from quotations ",(e,r)=>{
                                if(e){
                                    console.error(getTimeStamp()+" db.getQuotations(): ",e);
                                    reject({code:1,msg:"Could not retrieve quotations data",error:e});
                                }
                                else{
                                    resolve({code:0,msg:"successful",data:r});
                                }
                                con.release();
                                con.destroy();
                            })
                        }
                        else{
                            resolve({code:0,msg:"successful",data:[]});
                        }
                    }
                })
            })
            .catch(e=>{
                reject({code:1,msg:"Could not verify quotation table",error:e});
            })
                    
          
        })
        .catch(e=>{
            console.error(getTimeStamp()+" db.getQuotations(): ",e);
            reject(e)
        })
    })
}