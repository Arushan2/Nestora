Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$outputPath = Join-Path $PSScriptRoot 'Nestora-Testing-and-Evaluation.docx'
function X([string]$v) { [System.Security.SecurityElement]::Escape($v) }
function P([string]$t, [int]$s = 22, [bool]$b = $false, [string]$a = 'left') {
  $bo = if ($b) {'<w:b/>'} else {''}; $al = if ($a -eq 'left') {''} else {'<w:jc w:val="{0}"/>' -f $a}
  '<w:p><w:pPr>{0}</w:pPr><w:r><w:rPr>{1}<w:sz w:val="{2}"/></w:rPr><w:t xml:space="preserve">{3}</w:t></w:r></w:p>' -f $al,$bo,$s,(X $t)
}
function B([string]$h,[string]$t) {
  '<w:p><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>&#8226; {0}: </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>{1}</w:t></w:r></w:p>' -f (X $h),(X $t)
}
function C([string]$t,[bool]$b) {
  $bo=if($b){'<w:b/>'}else{''}; $r=foreach($l in ($t -split "`n")){'<w:r><w:rPr>{0}<w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">{1}</w:t></w:r>' -f $bo,(X $l)}
  '<w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr><w:p>{0}</w:p></w:tc>' -f ($r -join '<w:r><w:br/></w:r>')
}
function T([array]$rows) {
  $rowNumber = 0; $tr=foreach($r in $rows){$isHeader = $rowNumber -eq 0; $c=foreach($v in $r){C $v $isHeader}; $rowNumber++; '<w:tr>{0}</w:tr>' -f ($c -join '')}
  '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>{0}</w:tbl>' -f ($tr -join '')
}
$body=@()
$body+=P '4  Testing and Evaluation' 28 $true
$body+=P '4.1 Testing Approach' 24 $true
$body+=P 'Nestora was evaluated using the following testing approaches:'
$body+=B 'Unit Testing' 'Individual frontend components and backend functions were checked, including OTP validation, password handling, forms, notifications, cart calculations, and inventory updates.'
$body+=B 'Integration Testing' 'Connected modules were verified, including customer inquiries, provider offers, and PayHere payment callbacks that update order status and stock.'
$body+=B 'System Testing' 'Complete workflows were tested across the customer site, service-provider dashboard, seller dashboard, and administrator panel.'
$body+=B 'User Acceptance Testing (UAT)' 'Representative users reviewed main journeys for clarity, responsiveness, and correct role-based access.'
$body+=P '4.2 Test Cases and Results' 24 $true
$sets=@(
 @{id='TS_ID_001';name='Customer Panel';caption='Table 1 Customer Test Cases and Results';rows=@(@('Test ID','Test Case','Preconditions','Test Steps','Expected Result','Status'),@('CUST001','Register and OTP Verification','Customer is not registered','1. Register`n2. Enter details`n3. Verify OTP','Account is created and verified','Pass'),@('CUST002','Product Cart','Customer is logged in','1. Browse products`n2. Add product`n3. Open cart','Cart shows correct products and totals','Pass'),@('CUST003','Product Payment','Cart contains products','1. Open checkout`n2. Start PayHere payment','Order, payment, and stock statuses update','Pass'),@('CUST004','Service Inquiry','Customer is logged in','1. Open service`n2. Submit inquiry','Inquiry is saved and provider is notified','Pass'))},
 @{id='TS_ID_002';name='Service Provider Panel';caption='Table 2 Service Provider Test Cases and Results';rows=@(@('Test ID','Test Case','Preconditions','Test Steps','Expected Result','Status'),@('PROV001','Apply as Provider','Registered user is logged in','1. Join as Pro`n2. Select provider`n3. Submit','Application is submitted for review','Pass'),@('PROV002','Create Listing and Availability','Provider is approved','1. Add listing`n2. Set availability','Listing and calendar availability are saved','Pass'),@('PROV003','Send Service Offer','Customer inquiry exists','1. Open inquiry`n2. Add estimate`n3. Send offer','Customer receives service offer','Pass'),@('PROV004','Complete Service Work','Offer accepted','1. Update work status`n2. Mark complete','Service status updates for customer','Pass'))},
 @{id='TS_ID_003';name='Product Seller Panel';caption='Table 3 Product Seller Test Cases and Results';rows=@(@('Test ID','Test Case','Preconditions','Test Steps','Expected Result','Status'),@('SELL001','Apply as Seller','Registered user is logged in','1. Join as Pro`n2. Select seller`n3. Submit','Seller application is submitted','Pass'),@('SELL002','Publish Product Listing','Seller is approved','1. Add product details`n2. Publish','Product becomes available in store','Pass'),@('SELL003','Update Inventory','Product listing exists','1. Open inventory`n2. Change quantity','Stock quantity is updated','Pass'),@('SELL004','Fulfil Order','Paid order exists','1. Add delivery details`n2. Mark shipped','Order updates and customer is notified','Pass'))},
 @{id='TS_ID_004';name='Admin Panel';caption='Table 4 Admin Test Cases and Results';rows=@(@('Test ID','Test Case','Preconditions','Test Steps','Expected Result','Status'),@('ADM001','Admin Login','Admin account exists','1. Open login`n2. Sign in','Admin panel is displayed','Pass'),@('ADM002','Review Pro Application','Pending application exists','1. Review details`n2. Approve or reject','Decision is saved and applicant notified','Pass'),@('ADM003','Manage Payments','Payment records exist','1. Open payments panel`n2. Review transactions','Payment information is displayed','Pass'),@('ADM004','View Platform Analytics','Activity data exists','1. Open analytics`n2. Review metrics','Platform metrics are displayed','Pass'))}
)
foreach($s in $sets){$body+=P "Test Scenario ID: $($s.id)" 20 $true;$body+=P "Test Scenario: $($s.name)" 20 $true;$body+=T $s.rows;$body+=P $s.caption 18 $false 'center'}
$body+=P '4.3 Evaluation' 24 $true
$body+=B 'Performance' 'The React and Vite frontend delivered responsive navigation, while the PHP backend handled core requests efficiently during functional testing.'
$body+=B 'Security' 'Email OTP verification, password hashing, session authentication, and role-aware access controls protect accounts and restricted dashboard functions.'
$body+=B 'Usability' 'The responsive interface provides clear navigation for listings, inquiries, orders, and account tasks for all four user roles.'
$body+=B 'Reliability' 'Database-backed orders, inventory updates, notifications, and payment callback validation keep transaction workflows consistent and traceable.'
$body+=P 'Overall, the completed test cases show that Nestora meets its core functional and non-functional requirements and provides a secure, efficient, and user-friendly marketplace platform.'
$doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{0}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1080" w:bottom="1440" w:left="1080"/></w:sectPr></w:body></w:document>' -f ($body -join '')
$types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
$rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
if(Test-Path $outputPath){Remove-Item -LiteralPath $outputPath -Force};$z=[System.IO.Compression.ZipFile]::Open($outputPath,[System.IO.Compression.ZipArchiveMode]::Create)
try{foreach($e in @(@{p='[Content_Types].xml';c=$types},@{p='_rels/.rels';c=$rels},@{p='word/document.xml';c=$doc})){$i=$z.CreateEntry($e.p);$w=[System.IO.StreamWriter]::new($i.Open(),[System.Text.UTF8Encoding]::new($false));try{$w.Write($e.c)}finally{$w.Dispose()}}}finally{$z.Dispose()}
Write-Output "Created $outputPath"
