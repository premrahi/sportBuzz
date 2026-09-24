import express from "express" ;
import { matchRouter } from "./routes/matches.js";

const app = express() ;

const PORT = process.env.PORT || 8000 ;

app.use(express.json()) ;
app.use('/matches' , matchRouter)

app.get('/' , (req, res) => {
    res.json({message : "hehhehe"}) ;
})

app.listen(PORT , () => {
    console.log(`server is up!!! and running at : ${PORT}`);
})