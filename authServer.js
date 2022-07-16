require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require("./controllers/db");
const bodyParser = require('body-parser');
const https = require('https');
const app = express();

const fs = require('fs');
const key = fs.readFileSync("../certs/cert.key").toString();
const cert= fs.readFileSync("../certs/cert.crt").toString();
const credentials = {key:key,cert:cert};

const generateAccessToken = (cred)=>{
    return jwt.sign(cred,process.env.ACCESS_TOKEN_SECRET,{expiresIn:process.env.ACCESS_TOKEN_EXPIRATION});
}

app.use(express.json({limit:'50mb'}));
// app.use(bodyParser.json());
app.use(express.urlencoded({extended:true,limit:'50mb'}));
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
        let token = generateAccessToken({email:user.email});
        let refreshToken = jwt.sign({email:user.email},process.env.REFRESH_TOKEN_SECRET);
        db.saveToken(refreshToken,user.email).then(result=>{
            u.data.accessToken = token;
            res.status(200).json(u);
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
    let token = generateAccessToken({email:req.body.email});
    let refreshToken = jwt.sign({email:req.body.email},process.env.REFRESH_TOKEN_SECRET);
    db.signUp(req.body.email,req.body.password,refreshToken).then(result=>{
        result.data.accessToken = token;
        res.status(201).json(result);
    })
    .catch(e=>{
        res.status(409).json(e);
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
    jwt.verify(token,process.env.REFRESH_TOKEN_SECRET,(err,cred)=>{
        const accessToken = generateAccessToken(cred);
        res.json({accessToken:accessToken});
    })
})
const port = process.env.AUTH_PORT;
app.set("port",port);

const httpsServer = https.createServer(credentials,app);
httpsServer.listen(port,()=>{
    console.log("Cleaford AuthServer running on ",port);
})
