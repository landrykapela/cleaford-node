require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require("./controllers/db");
const cors = require('cors');
const app = express();

let tokens = [];
const generateAccessToken = (user)=>{
    return jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'10m'});
}

app.use(express.json());
//set CORS
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,GET,PUT,PATCH,DELETE");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
    );
    next();
  });
app.post("/signin",(req,res)=>{
    let user = {email:req.body.email,password:req.body.password};
    db.signIn(user.email,user.password).then(result=>{
        let token = generateAccessToken(user);
        let refreshToken = jwt.sign(user,process.env.REFRESH_TOKEN_SECRET);
        db.saveToken(refreshToken,user);
        res.json({accessToken:token,refreshToken:refreshToken});
    })
    .catch(e=>{
        res.sendStatus(401)
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
app.delete("/signout",(req,res)=>{
    tokens = tokens.filter(t=>{
        return t !== req.body.token;
    })
    res.sendStatus(204);
})

//refresh token
app.post("/token",(req,res)=>{
    let token = req.body.token;
    if(token == null) res.sendStatus(401);
    if(!tokens.includes(token)) res.sendStatus(403);
    jwt.verify(token,process.env.REFRESH_TOKEN_SECRET,(err,user)=>{
        const accessToken = generateAccessToken({email:user.email,password:user.password});
        res.json({accessToken:accessToken});
    })
})
const port = process.env.AUTH_PORT;
app.set("port",port);
app.listen(port,()=>{
    console.log("Cleaford AuthServer running on ",port);
})