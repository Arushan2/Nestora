<?php

declare(strict_types=1);

namespace Nestora\Controllers;

use Nestora\Core\Base\AbstractController;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use Nestora\Repositories\ProApplicationRepository;
use Nestora\Repositories\UserRepository;
use Nestora\Core\Services\CloudinaryStorageService;
use Throwable;

class ApplicationController extends AbstractController
{
    private ProApplicationRepository $applicationRepository;
    private UserRepository $userRepository;
    private CloudinaryStorageService $storageService;

    public function __construct()
    {
        parent::__construct();
        $this->applicationRepository = new ProApplicationRepository();
        $this->userRepository = new UserRepository();
        $this->storageService = new CloudinaryStorageService();
    }

    public function create(Request $request): Response
    {
        $user = $this->currentUserOrFail($request);
        $data = $request->getBody();

        $applicationType = (string) ($data['applicationType'] ?? '');
        $allowedTypes = ['service_provider', 'product_seller'];

        if (!in_array($applicationType, $allowedTypes, true)) {
            return $this->error(422, 'Select a valid application type.');
        }

        $businessName = trim((string) ($data['businessName'] ?? ''));
        $businessEmail = strtolower(trim((string) ($data['businessEmail'] ?? '')));
        $businessPhone = trim((string) ($data['businessPhone'] ?? ''));
        $businessAddress = trim((string) ($data['businessAddress'] ?? ''));
        $businessCity = trim((string) ($data['businessCity'] ?? ''));
        $businessDescription = trim((string) ($data['businessDescription'] ?? ''));
        $documentType = trim((string) ($data['documentType'] ?? ''));
        $documentNumber = trim((string) ($data['documentNumber'] ?? ''));
        $documentFile = trim((string) ($data['documentFile'] ?? ''));
        $selectedPlan = trim((string) ($data['selectedPlan'] ?? ''));

        $uploadedFile = $request->getFile('business_registration_document');
        if ($uploadedFile && is_uploaded_file($uploadedFile['tmp_name'])) {
            try {
                $documentFile = $this->storageService->upload($uploadedFile['tmp_name'], $uploadedFile['name']);
            } catch (Throwable $e) {
                return $this->error(500, 'Unable to upload document.', ['details' => $e->getMessage()]);
            }
        }

        $bankName = trim((string) ($data['bankName'] ?? ''));
        $accountHolderName = trim((string) ($data['accountHolderName'] ?? ''));
        $accountNumber = trim((string) ($data['accountNumber'] ?? ''));
        $branch = trim((string) ($data['branch'] ?? ''));

        if ($businessName === '' || $businessEmail === '' || $businessPhone === '' || $businessAddress === '' || $businessCity === '' || $businessDescription === '' || $documentFile === '') {
            return $this->error(422, 'Business details and a registration document are required.');
        }

        if ($applicationType === 'product_seller') {
            if ($bankName === '' || $accountHolderName === '' || $accountNumber === '' || $branch === '') {
                return $this->error(422, 'Bank Name, Account Holder Name, Account Number, and Branch details are required for Product Sellers.');
            }
        }

        $sql = 'INSERT INTO pro_applications (
            user_id, application_type, business_name, business_email, business_phone,
            business_address, business_city, business_description, document_type, document_number,
            document_file, selected_plan, status, bank_name, account_holder_name, account_number, branch,
            created_at, updated_at
        ) VALUES (
            :user_id, :application_type, :business_name, :business_email, :business_phone,
            :business_address, :business_city, :business_description, :document_type, :document_number,
            :document_file, :selected_plan, "pending", :bank_name, :account_holder_name, :account_number, :branch,
            NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
            application_type = VALUES(application_type),
            business_name = VALUES(business_name),
            business_email = VALUES(business_email),
            business_phone = VALUES(business_phone),
            business_address = VALUES(business_address),
            business_city = VALUES(business_city),
            business_description = VALUES(business_description),
            document_type = VALUES(document_type),
            document_number = VALUES(document_number),
            document_file = VALUES(document_file),
            selected_plan = VALUES(selected_plan),
            status = "pending",
            bank_name = VALUES(bank_name),
            account_holder_name = VALUES(account_holder_name),
            account_number = VALUES(account_number),
            branch = VALUES(branch),
            updated_at = NOW()';

        $this->db->query($sql, [
            'user_id' => $user['id'],
            'application_type' => $applicationType,
            'business_name' => $businessName,
            'business_email' => $businessEmail,
            'business_phone' => $businessPhone,
            'business_address' => $businessAddress,
            'business_city' => $businessCity,
            'business_description' => $businessDescription,
            'document_type' => $documentType,
            'document_number' => $documentNumber,
            'document_file' => $documentFile,
            'selected_plan' => $selectedPlan,
            'bank_name' => $bankName,
            'account_holder_name' => $accountHolderName,
            'account_number' => $accountNumber,
            'branch' => $branch,
        ]);

        $app = $this->applicationRepository->findByUserId((int) $user['id']);
        return $this->json(201, ['application' => $app, 'message' => 'Application submitted successfully.']);
    }

    public function listPending(Request $request): Response
    {
        $this->requireAdmin($request);
        $pending = $this->applicationRepository->findPendingWithUser();
        return $this->json(200, ['applications' => $pending]);
    }

    public function approve(Request $request, int $id): Response
    {
        $this->requireAdmin($request);

        $app = $this->applicationRepository->find($id);
        if (!$app) {
            return $this->error(404, 'Application not found.');
        }

        $this->applicationRepository->update($id, [
            'status' => 'approved',
            'reviewed_at' => date('Y-m-d H:i:s')
        ]);

        $this->userRepository->updateRole((int) $app['user_id'], (string) $app['application_type']);

        return $this->json(200, ['message' => 'Application approved successfully.']);
    }
}
