const mysql = require("mysql");
const config = require("./config.json");
const bcrypt = require("bcrypt");


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
                resolve(rows);
            }
        })
    })
}
exports.signIn = (email,password)=>{
    return new Promise((resolve,reject)=>{
        console.log("sigining in "+email);
        resolve("successful")
    });
    
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