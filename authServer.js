require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require("./controllers/db");
const bodyParser = require('body-parser');
const app = express();
const fs = require('fs');
const generateAccessToken = (user)=>{
    return jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'10m'});
}

app.use(express.json());
app.use(bodyParser.json());
//set CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST,GET,PUT,PATCH,DELETE");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
    );
    next();
  });
app.post("/signin",(req,res)=>{
    let user = {email:req.body.email,password:req.body.password};
    db.signIn(user.email,user.password).then(u=>{
        let token = generateAccessToken(user);
        let refreshToken = jwt.sign(user,process.env.REFRESH_TOKEN_SECRET);
        db.saveToken(refreshToken,user).then(result=>{
            result.accessToken = token;
            res.status(200).json(result);
        }).catch(e=>{
            res.status(200).json(e)
        });
    })
    .catch(e=>{
        console.error("error: ",e);
        res.status(200).json(e)
    })
    
})

app.post("/signup",(req,res)=>{
    let user = {email:req.body.email,password:req.body.password};
    let token = generateAccessToken(user);
    let refreshToken = jwt.sign(user,process.env.REFRESH_TOKEN_SECRET);
    user.token = refreshToken;
    db.signUp(user).then(result=>{
        res.json({accessToken:token,refreshToken:refreshToken});
    })
    .catch(e=>{
        res.sendStatus(203);
    })
    
})

//signout
app.post("/signout",(req,res)=>{
    db.signout(req.body.email)
    .then((success)=>{
        res.status(200).json(success);
    }).catch(e=>{
        res.status(200).json(e);
    })
    
})

//refresh token
app.post("/token",(req,res)=>{
    let token = req.body.token;
    if(token == null) res.sendStatus(401);
    jwt.verify(token,process.env.REFRESH_TOKEN_SECRET,(err,user)=>{
        const accessToken = generateAccessToken({email:user.email,password:user.password});
        res.json({accessToken:accessToken});
    })
})
const port = process.env.AUTH_PORT;
app.set("port",port);
const  key = fs.readFileSync("../certs/cert.key").toString();
const  cert = fs.readFileSync("../certs/cert.crt").toString();
const credentials ={key:key,cert:cert};
require('https').createServer(credentials,app).listen(port,()=>{
    console.log("Cleaford AuthServer running on ",port);
})
