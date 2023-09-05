const stripe = require('stripe')('sk_test_51NlUc8H8UpWaisRsh6LOhRnXRykn8FNZO0CLYoLRlOWWBTViBq0buaxCpyB5iR3WHSO7uWUGcmxOEg6c303sIA4G00qVkx4wRP');
// const stripe = require('stripe')('sk_test_1xdtxPRr3dEaOBrLBi8c0OVh');
// const stripe = require('stripe')('sk_test_51Nmp0aDBoEL4nVgEyYWg4Hf1QPzcm4EmME8hO10R1UV5q7Hycc67W1VkbTppXTDJ5EMLDPI1K08IMxWVfPpVgM4L00e5Ra0Iuk');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
// const config = require('config');

const Block = require('./models/Blocks');


const app = express();
// const YOUR_DOMAIN = 'http://localhost:3000/buy';
const YOUR_DOMAIN = 'http://talysis15.co.uk/buy';
const endpointSecret = 'whsec_...';
// const priceID = 'price_1Nmp4hDBoEL4nVgEsJyZtbEk';
const priceID = 'price_1Nmi9FH8UpWaisRscayjkLmi';

connectDB();

app.use(cors())
app.use(express.static("public"));
app.use(express.json());

// app.use('/api/block', require('./routes/api/block'));
app.use(bodyParser.urlencoded({limit: '50mb', extended: false }));
app.use(bodyParser.json({limit: '50mb'}));

const fulfillOrder = (session) => {
    // TODO: fill me in
    console.log("Fulfilling order", session);
}
  
const createOrder = (session) => {
    // TODO: fill me in
    console.log("Creating order", session);
}

const emailCustomerAboutFailedPayment = (session) => {
    // TODO: fill me in
    console.log("Emailing customer", session);
}

const handleDownload = async (historyData) => {
    let persons = []
    let k = 0;
    for(let i = historyData?.length-1; i>=0; i--){
        let person = "";
        k++;
        const id = k;
        const blocks = historyData[i]['blocks'];
        const date = historyData[i]['date'];
        person = '{"id":"'+id+'", "blocks":"'+blocks+'", "date":"'+date+'"}';
        persons.push(JSON.parse(person));
    }
    // console.log('person', persons);
    const worksheet = XLSX.utils.json_to_sheet(JSON.parse(JSON.stringify(persons)));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    //let buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    //XLSX.write(workbook, { bookType: "xlsx", type: "binary" });
    XLSX.writeFile(workbook, "../../output.xlsx");
}

app.get('/create-checkout-session', async (req, res) => {
    try {
        const blocks = await Block.find({}, 'email blocks date').sort({ date: -1 });
        
        // console.log("gsName-------", blocks);
        res.json(blocks);
    
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});


app.post('/create-checkout-session', async (req, res) => {
    const blocks = req.body.blocks;
    const blockNum = blocks.length;
    
    
    const session = await stripe.checkout.sessions.create({
        line_items: [
        {
            // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
            price: priceID,
            quantity: blockNum,
        },
        ],
        mode: 'payment',
        success_url: `${YOUR_DOMAIN}?success=true`,
        cancel_url: `${YOUR_DOMAIN}?canceled=true`,
    });
    
    const sessionId = session.id;
    if(sessionId){
    //     const customers = await stripe.customers.list({});
    //     console.log('cs', customers);
    //     customers.data.forEach(customer => {
    //         console.log(customer.email);
    //     });
    //     // retrieveSession(session.id);
        const email = session.customer_email;
        const blocks = req.body.blocks;
    //     // console.log('blocks', blocks);
    //     // console.log('res', blocks[2]);

    //     // Add email and blocks to Database
        try {
            const newBlocks = new Block({
                email: email,
                blocks: blocks,
            });
        
            await newBlocks.save();
        
            // res.json(newBlocks);
        } catch (err) {
            console.error(err.message);
            // res.status(500).send("Server Error");
        }

        try {
            const persons = await Block.find({}, 'email blocks date').sort({ date: -1 });
            // console.log('blocks', persons);
            handleDownload(persons);
            // res.json(blocks);
        
        } catch (err) {
            console.error(err.message);
            // res.status(500).send("Server Error");
        }

    //     stripe.charges.list({ limit: 10 }, (err, charges) => {
    //         if (err) {
    //             console.error('Error retrieving charges:', err);
    //             return;
    //         }
          
    //         charges.data.forEach(charge => {
    //             const customerEmail = charge.receipt_email;
    //             console.log('Customer Email:', customerEmail);
    //         });
    //     });

        res.send({id:session.id});
    }

    
    // res.redirect(303, session.url);
    // res.send({
    //     sessionId: session.id,
    // });
    
});

app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (request, response) => {
    const payload = request.body;
    const sig = request.headers['stripe-signature'];
  
    let event;
  
    try {
        event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
  
    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            // Save an order in your database, marked as 'awaiting payment'
            createOrder(session);
        
            // Check if the order is paid (for example, from a card payment)
            //
            // A delayed notification payment will have an `unpaid` status, as
            // you're still waiting for funds to be transferred from the customer's
            // account.
            if (session.payment_status === 'paid') {
                fulfillOrder(session);
            }
        
            break;
        }
    
        case 'checkout.session.async_payment_succeeded': {
            const session = event.data.object;
        
            // Fulfill the purchase...
            fulfillOrder(session);
        
            break;
        }
    
        case 'checkout.session.async_payment_failed': {
            const session = event.data.object;
        
            // Send an email to the customer asking them to retry their order
            emailCustomerAboutFailedPayment(session);
        
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }
  
    // Return a 200 response to acknowledge receipt of the event
    response.send();
});

app.listen(4242, () => console.log('Running on port 4242'));