import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const { phoneNumber, queueName, ticketSeq } = await req.json();

        if (!phoneNumber || !queueName || !ticketSeq) {
            return Response.json({ 
                error: 'Missing required parameters: phoneNumber, queueName, ticketSeq' 
            }, { status: 400 });
        }

        // Get secrets
        const username = Deno.env.get("SIMPLYCLUB_USERNAME");
        const encryptPassword = Deno.env.get("SIMPLYCLUB_ENCRYPT_PASSWORD");
        const senderName = Deno.env.get("SIMPLYCLUB_SENDER_NAME");

        if (!username || !encryptPassword || !senderName) {
            return Response.json({ 
                error: 'SMS service not configured properly' 
            }, { status: 500 });
        }

        // Build SMS message exactly as specified
        const message = `שוק העיר\nמחלקת ${queueName}\nמספר התור שלך: ${ticketSeq}\n\nלהצטרפות למועדון:\nhttps://s1c.me/shukhair_01`;

        // Build form-urlencoded body
        const formData = new URLSearchParams();
        formData.append('UserName', username);
        formData.append('EncryptPassword', encryptPassword);
        formData.append('Subscribers', phoneNumber);
        formData.append('SenderName', senderName);
        formData.append('Message', message);

        // Send SMS via SimplyClub HTTP POST
        const response = await fetch('https://simplesms.co.il/webservice/SmsWS.asmx/SendSms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        const responseText = await response.text();

        // Check if request was successful
        if (!response.ok) {
            console.error('SimplyClub API error:', responseText);
            return Response.json({ 
                error: 'Failed to send SMS',
                details: responseText
            }, { status: 500 });
        }

        // Parse XML response to check for success
        // SimplyClub returns XML with status information
        const isSuccess = responseText.includes('<int>') && !responseText.includes('error');

        if (isSuccess) {
            return Response.json({ 
                success: true,
                message: 'SMS sent successfully'
            });
        } else {
            console.error('SimplyClub response indicates failure:', responseText);
            return Response.json({ 
                error: 'SMS service returned an error',
                details: responseText
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Error in sendSms function:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});