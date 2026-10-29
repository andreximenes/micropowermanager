<?php

namespace App\Http\Controllers;

use App\Http\Requests\TransactionExportRequest;
use App\Models\Transaction\Transaction;
use App\Services\ExportServices\AbstractExportService;
use App\Services\ExportServices\TransactionExportService;
use App\Services\MainSettingsService;
use App\Services\TransactionService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[Group('Export', 'Export data as Excel, CSV, or JSON.', weight: 11)]
class TransactionExportController {
    public function __construct(
        private TransactionService $transactionService,
        private TransactionExportService $transactionExportService,
        private MainSettingsService $mainSettingsService,
    ) {}

    /**
     * Export transactions.
     *
     * Downloads transactions as an Excel or CSV file, or returns them as JSON.
     *
     * @throws AuthenticationException
     * @throws AuthorizationException
     */
    public function download(TransactionExportRequest $request): StreamedResponse|JsonResponse {
        $format = $request->input('format', 'excel');

        if ($format === 'csv') {
            return $this->downloadCsv($request);
        }

        if ($format === 'json') {
            return $this->downloadJson($request);
        }

        return $this->downloadExcel($request);
    }

    public function downloadExcel(TransactionExportRequest $request): StreamedResponse {
        $this->transactionExportService->setCurrency($this->currency());
        $this->transactionExportService->createSpreadSheetFromTemplate($this->transactionExportService->getTemplatePath());
        $this->transactionExportService->setTransactionData($this->filteredTransactions($request));
        $this->transactionExportService->setExportingData();
        $this->transactionExportService->writeTransactionData();
        $pathToSpreadSheet = $this->transactionExportService->saveSpreadSheet();

        return Storage::download($pathToSpreadSheet, 'transaction_export_'.now()->format('Ymd_His').'.xlsx', ['Content-Type' => AbstractExportService::XLSX_CONTENT_TYPE]);
    }

    public function downloadCsv(TransactionExportRequest $request): StreamedResponse {
        $this->transactionExportService->setCurrency($this->currency());
        $this->transactionExportService->setTransactionData($this->filteredTransactions($request));
        $this->transactionExportService->setExportingData();
        $headers = ['Status', 'Payment Service', 'Customer', 'Device Serial Number', 'Device Type', 'Amount', 'Type', 'Date'];
        $csvPath = $this->transactionExportService->saveCsv($headers);

        return Storage::download($csvPath, 'transaction_export_'.now()->format('Ymd_His').'.csv', ['Content-Type' => AbstractExportService::CSV_CONTENT_TYPE]);
    }

    public function downloadJson(TransactionExportRequest $request): JsonResponse {
        $currency = $this->currency();
        $this->transactionExportService->setCurrency($currency);
        $this->transactionExportService->setTransactionData($this->filteredTransactions($request));
        $jsonData = $this->transactionExportService->exportDataToArray();

        return response()->json([
            'data' => $jsonData,
            'meta' => [
                'total' => count($jsonData),
                'currency' => $currency,
                'filters' => [
                    'device_type' => $request->input('deviceType', 'all'),
                    'serial_number' => $request->input('serial_number'),
                    'tariff' => $request->input('tariff'),
                    'provider' => $request->input('provider', 'all'),
                    'status' => $request->input('status'),
                    'from_date' => $request->input('from'),
                    'to_date' => $request->input('to'),
                ],
                'exported_at' => now()->toISOString(),
            ],
        ]);
    }

    /**
     * Every format applies the same filters, so a download matches the list it was started from.
     *
     * @return Collection<int, Transaction>
     */
    private function filteredTransactions(TransactionExportRequest $request): Collection {
        $tariffId = $request->input('tariff');
        $status = $request->input('status');

        /** @var Collection<int, Transaction> $transactions */
        $transactions = $this->transactionService->search(
            $request->input('deviceType') ?: 'all',
            $request->input('serial_number'),
            $tariffId !== null ? (int) $tariffId : null,
            $request->input('provider') ?: 'all',
            $status !== null ? (int) $status : null,
            $request->input('from'),
            $request->input('to'),
        );

        return $transactions;
    }

    private function currency(): string {
        return $this->mainSettingsService->getAll()->first()->currency;
    }
}
