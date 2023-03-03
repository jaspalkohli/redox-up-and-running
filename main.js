const jose = require('jose');
const axios = require('axios');
const randomBytes = require('crypto').randomBytes;
const qsStringify = require('querystring').stringify;
const https = require('node:https');

// import your private key as PEM or JWK
const privateKeyPEM = ``;  // INSERT PRIVATE PEM KEY HERE

const clientId = '<INSERT CLIENT ID HERE>';
const iat = Math.floor(new Date().getTime()/1000);  // Current timestamp in seconds (undefined is valid)
const aud = 'https://api.redoxengine.com/v2/auth/token';
const kid = '<INSERT KID HERE>';
const scope = 'fhir:development'; // valid scopes are 'fhir:development', 'fhir:staging', or 'fhir:production'



async function getSignedAssertion(clientId, privateKeyPEM, kid, aud, iat, scope) {
    const privateKey = await jose.importPKCS8(privateKeyPEM, 'RS384');

    const payload = {
        scope,
    };

    const signedAssertion = await new jose.SignJWT(payload)
    .setProtectedHeader({
        alg: 'RS384',
        kid: kid
    })
    .setAudience(aud)
    .setIssuer(clientId)
    .setSubject(clientId)
    .setIssuedAt(iat)
    .setJti(randomBytes(8).toString('hex')) // a random string to prevent replay attacks
    .sign(privateKey);

    return signedAssertion;
}

async function requestJwtAccessTokenAxios(signedAssertion, scope) {
    const requestBody = qsStringify({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: signedAssertion,
      scope
    });
  
    try {
      const result = await axios.post(
        "https://api.redoxengine.com/v2/auth/token", requestBody, {
          headers: {
            'content-type': 'application/x-www-form-urlencoded'
          }
        }
      );
  
      // return response with keys: access_token, scope, token_type, and expires_in
      return result.data;
    }
    catch(e) {
      return e.response.data;
    }
}

async function requestJwtAccessTokenNoLibrary(signedAssertion, scope) {

    const requestBody = qsStringify({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: signedAssertion,
        scope
      });

    const options = {
        method: 'POST',
        headers: { 
            'content-type': 'application/x-www-form-urlencoded'
        }
    };

    return new Promise(function(resolve, reject) {
        try {
            const req = https.request('https://api.redoxengine.com/v2/auth/token', options, (res) => {
                console.log('statusCode:', res.statusCode);
                console.log('headers:', res.headers);
                let data = '';
                
                res.on('data', (d) => {
                    data += d;
                });
                res.on('end', (d) =>{
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                });
                res.on('error', (error) => {
                    throw error;
                })
            });
        
            req.write(requestBody);
            req.end();
        }
        catch(e) {
            reject(e);
        }
        
    });
}

(async() => {
    const signedAssertion = await getSignedAssertion(clientId, privateKeyPEM, kid, aud, iat, scope);
    const accessTokenAxios = await requestJwtAccessTokenAxios(signedAssertion, scope);
    const accessTokenNoLibrary = await requestJwtAccessTokenNoLibrary(signedAssertion, scope);
    console.log({accessTokenAxios});
    console.log({accessTokenNoLibrary});
})();