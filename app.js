/**
 *
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var AssistantV2 = require('ibm-watson/assistant/v2'); // watson sdk

var request = require('request');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
var cors = require('cors');
var app = express();
//require('./public/js/conversation.js')(app,multer,request,path,fs);

const {IamAuthenticator, BearerTokenAuthenticator } = require('ibm-watson/auth');


require('./health/health')(app);

//Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

//added by Anuram
app.use(cors());
app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "http://10.10.1.40:3000"); // update to match the domain you will make the request from
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

app.get('/', function(req, res) {
	// Handle the get for this route
});

app.post('/', function(req, res) {
	// Handle the post for this route
});

// till here added by anuram
//Create the service wrapper

//added by anuram

//added by ayyan
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage
}).single('filename');

app.post('/api/upload', (req, res) => {
    var filep = "";
    console.log("inside app post");
    upload(req, res, (err) => {
        if (err) {
            console.log(err);
        } else {
            if (req.file === undefined) {
                return res.send('not selecting files');
            }   
            console.log("request",req.file);
            filep = path.join(__dirname, "./public/uploads/" + req.file.filename);
            const options = {
                method: "POST",
                url: "http://localhost:8080/upload",
                headers: {
                    "Content-Type": "multipart/form-data"
                },
                formData: {
                    "uploadFile": fs.createReadStream(filep)
                }
            };
            request(options, function (err, httpResponse, body) {
                if (err === undefined)
                   return res.send(err.toString());
                else
                   return  res.send(body.toString());
            });
            fs.unlink(filep, err => console.log(err));
        }
    });
});
//added by ayyan

app.post('/api/claimnumber', function(req, res) {
	console.log(req);
	var claimNumber=req.body.claimNumber;
	console.log("http://localhost:8081/create?claimNumber="+ claimNumber);
	request.get({url: "http://localhost:8081/create?claimNumber="+ claimNumber},  function(error, response, body) {

		if (!error && (response.statusCode == 200 || response.statusCode == 201)) {
			console.log("Body is",body);
			res.send(body);
		}
		else{
			console.log("Error is",error);
			res.send(error);
		}

	});
});

app.post('/api/createCase', function(req, res) {		
	
	/*var username = 'admin';
	var password = 'passw0rd';*/
	var options = {
			url: 'https://wf-dc-poc.ibm.edu:9443/CaseManager/CASEREST/v1/cases',
			headers:{
				'Content-type': 'application/json',
				'Access-Control-Allow-Credential':'true',
				'Authorization': 'Basic YWRtaW46cGFzc3cwcmQ=s'	    			
			},
			/*auth:{
				user: username,
				password: password
			},*/
			 method: 'POST',
			 json:req.body
	}
	request(options,  function(error, response, body) {
		console.log("status code",response.statusCode);
		if (response.statusCode == 200 || response.statusCode == 201) {
			console.log("Response is",response)
			console.log("Body is",body);
			res.send(body);
		}
		else{
			console.log("Error is",error);
			res.send(error);
		}
		
	});
});

//added by ayyan



let authenticator;
if (process.env.ASSISTANT_IAM_APIKEY) {
	authenticator = new IamAuthenticator({
		apikey: process.env.ASSISTANT_IAM_APIKEY
	});
} else if (process.env.BEARER_TOKEN) {
	authenticator = new BearerTokenAuthenticator({
		bearerToken: process.env.BEARER_TOKEN
	});
}

var assistant = new AssistantV2({
	version: '2019-02-28',
	authenticator: authenticator,
	url: process.env.ASSISTANT_URL,
	disableSslVerification: process.env.DISABLE_SSL_VERIFICATION === 'true' ? true : false
});

//Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
	let assistantId = process.env.ASSISTANT_ID || '<assistant-id>';
	if (!assistantId || assistantId === '<assistant-id>') {
		return res.json({
			output: {
				text:
					'The app has not been configured with a <b>ASSISTANT_ID</b> environment variable. Please refer to the ' +
					'<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' +
					'Once a workspace has been defined the intents may be imported from ' +
					'<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.',
			},
		});
	}

	var textIn = '';

	if (req.body.input) {
		textIn = req.body.input.text;
	}

	var payload = {
			assistantId: assistantId,
			sessionId: req.body.session_id,
			input: {
				message_type: 'text',
				text: textIn,
			},
	};

	// Send the input to the assistant service
	console.log("payload",payload);
	assistant.message(payload, function(err, data) {
		if (err) {
			const status = err.code !== undefined && err.code > 0 ? err.code : 500;
			return res.status(status).json(err);
		}
		console.log("Generics",data.result.output.generic);
		console.log("Entities",data.result.output.entities);
		console.log("Intent",data.result.output.intents);
		return res.json(data);
	});
});

app.get('/api/session', function(req, res) {
	assistant.createSession(
			{
				assistantId: process.env.ASSISTANT_ID || '{assistant_id}',
			},
			function(error, response) {
				if (error) {
					return res.send(error);
				} else {
					return res.send(response);
				}
			}
	);
}
);

module.exports = app;
