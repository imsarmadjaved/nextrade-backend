import React, { useState, useEffect } from "react";
import {
  FaSearch,
  FaCheck,
  FaTimes,
  FaEye,
  FaMoneyBillWave,
  FaCalendar,
  FaImage,
  FaUser,
  FaDownload,
  FaBan,
  FaPlay,
  FaCheckDouble,
  FaMoneyCheck,
  FaReceipt,
  FaSpinner,
  FaCreditCard,
  FaUserCheck,
  FaClock,
  FaHourglassHalf,
  FaBullhorn,
} from "react-icons/fa";
import API from "../../api/axiosInstance";
import { toast } from "react-toastify";

const AdminAdsManagement = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAd, setSelectedAd] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    show: false,
    type: "",
    adId: null,
    adTitle: "",
    message: "",
    rejectionReason: "",
    action: null,
  });
  const [stats, setStats] = useState({
    totalAds: 0,
    pendingAds: 0,
    approvedAds: 0,
    rejectedAds: 0,
    totalRevenue: 0,
  });
  const [error, setError] = useState("");
  const [sellerProfiles, setSellerProfiles] = useState({});
  const [pendingPayments, setPendingPayments] = useState([]);
  const [paymentStats, setPaymentStats] = useState({
    totalPayments: 0,
    awaitingPaymentCount: 0,
    pendingApprovalCount: 0,
    completedPayments: 0,
    failedPayments: 0,
    totalRevenue: 0,
  });
  const [activeTab, setActiveTab] = useState("allAds");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false);
  const [rejectionInput, setRejectionInput] = useState("");

  // Fetch ads data
  const fetchAds = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/ads/all");
      const adsData = response.data || [];
      setAds([...adsData]);

      const totalAds = adsData.length;
      const pendingAds = adsData.filter((ad) => ad.status === "pending").length;
      const approvedAds = adsData.filter(
        (ad) => ad.status === "approved"
      ).length;
      const rejectedAds = adsData.filter(
        (ad) => ad.status === "rejected"
      ).length;
      const totalRevenue = adsData
        .filter((ad) => ad.payment?.status === "completed")
        .reduce((sum, ad) => sum + (ad.totalCost || 0), 0);

      setStats({
        totalAds,
        pendingAds,
        approvedAds,
        rejectedAds,
        totalRevenue,
      });
    } catch (error) {
      console.error("Error fetching ads:", error);
      setError("Failed to fetch advertisements. Please try again.");
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch pending payments
  const fetchPendingPayments = async () => {
    try {
      const response = await API.get("/payments/admin/pending");
      const paymentsData = response.data.payments || [];

      const processedPayments = await Promise.all(
        paymentsData.map(async (payment) => {
          try {
            if (payment.itemId && typeof payment.itemId === "string") {
              const adResponse = await API.get(`/ads/${payment.itemId}`);
              return { ...payment, adDetails: adResponse.data };
            }
            return payment;
          } catch (error) {
            console.error("Error fetching ad details:", error);
            return payment;
          }
        })
      );

      setPendingPayments(processedPayments);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      setPendingPayments([]);
    }
  };

  // Fetch payment statistics
  const fetchPaymentStats = async () => {
    try {
      const response = await API.get("/payments/admin/statistics");
      setPaymentStats(response.data);
    } catch (error) {
      console.error("Failed to fetch payment statistics:", error);
    }
  };

  useEffect(() => {
    fetchAds();
    fetchPendingPayments();
    fetchPaymentStats();

    const interval = setInterval(() => {
      fetchAds();
      fetchPendingPayments();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const hasPaymentProof = (payment) => {
    return Boolean(payment?.proofImage);
  };

  // Fetch seller profile
  const fetchSellerProfile = async (sellerId) => {
    if (!sellerId || sellerProfiles[sellerId]) return;

    try {
      const response = await API.get(`/profile/${sellerId}`);
      setSellerProfiles((prev) => ({
        ...prev,
        [sellerId]: response.data,
      }));
    } catch (error) {
      console.error(`Failed to fetch profile for seller ${sellerId}:`, error);
      setSellerProfiles((prev) => ({
        ...prev,
        [sellerId]: {
          phone: "Not available",
          address: "Not available",
          businessType: "Not specified",
          city: "Not specified",
          shopName: "Not available",
        },
      }));
    }
  };

  // Get image URL - UPDATED FUNCTION
  const getImageUrl = (imageData) => {
    if (!imageData) return null;

    // If it's already a URL
    if (typeof imageData === "string") {
      if (imageData.startsWith("http")) return imageData;
      if (imageData.startsWith("/uploads/")) {
        return `https://nextrade-backend-production-a486.up.railway.app${imageData}`;
      }
      return `https://nextrade-backend-production-a486.up.railway.app/uploads/${imageData}`;
    }

    // If it's an object with url property
    if (typeof imageData === "object" && imageData !== null) {
      if (imageData.url) return getImageUrl(imageData.url);
      if (imageData.secure_url) return imageData.secure_url;
      if (imageData.path) return getImageUrl(imageData.path);
    }

    // If it's an array
    if (Array.isArray(imageData) && imageData.length > 0) {
      return getImageUrl(imageData[0]);
    }

    return null;
  };

  // Get ad image
  const getAdImage = (ad) => {
    if (!ad) return null;

    // Try different possible image properties
    const possibleImageSources = [
      ad.image,
      ad.images,
      ad.imageUrl,
      ad.image_url,
    ].filter(Boolean);

    for (const source of possibleImageSources) {
      const url = getImageUrl(source);
      if (url) return url;
    }

    return null;
  };

  // Filter ads
  const filteredAds = ads.filter((ad) => {
    const matchesSearch =
      ad.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ad.seller?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || ad.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Update ad status
  const updateAdStatus = async (adId, newStatus, rejectionReason = "") => {
    try {
      const requestData = { status: newStatus };
      if (newStatus === "rejected" && rejectionReason) {
        requestData.rejectionReason = rejectionReason;
      }

      const response = await API.put(`/ads/${adId}/status`, requestData);

      if (response.data) {
        toast.success(`Ad ${newStatus} successfully`);
        await fetchAds();
        await fetchPendingPayments();
        await fetchPaymentStats();
      }

      hideConfirmationModal();
      if (showDetailModal) setShowDetailModal(false);
    } catch (error) {
      console.error("Error updating ad status:", error);
      toast.error(
        error.response?.data?.message || "Failed to update ad status"
      );
      hideConfirmationModal();
    }
  };

  // Toggle ad active status
  const toggleAdActive = async (adId, isActive) => {
    try {
      const response = await API.put(`/ads/${adId}`, { isActive });

      if (response.data) {
        toast.success(`Ad ${isActive ? "activated" : "paused"} successfully`);
        await fetchAds();
      }

      hideConfirmationModal();
      if (showDetailModal) setShowDetailModal(false);
    } catch (error) {
      let errorMessage = "Failed to update ad status";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage =
          "Cannot activate ad. Ad must be approved and paid first.";
      }
      toast.error(errorMessage);
      hideConfirmationModal();
    }
  };

  // Show confirmation modal
  const showConfirmationModal = (type, adId, adTitle, action = null) => {
    const messages = {
      approve: `Approve the ad "${adTitle}"?`,
      reject: `Reject the ad "${adTitle}"?`,
      activate: `Activate the ad "${adTitle}"?`,
      pause: `Pause the ad "${adTitle}"?`,
    };

    setConfirmationModal({
      show: true,
      type,
      adId,
      adTitle,
      message: messages[type] || "Confirm this action?",
      rejectionReason: "",
      action,
    });
  };

  // Handle payment verification
  const handleVerifyPayment = async (paymentId, action) => {
    try {
      if (action === "verify") {
        await API.put(`/payments/admin/${paymentId}/verify`);
        toast.success("Payment verified successfully! Ad is now active.");
      } else {
        const reason = prompt("Enter rejection reason:");
        if (!reason) return;
        await API.put(`/payments/admin/${paymentId}/reject`, { reason });
        toast.success("Payment rejected successfully");
      }

      await fetchAds();
      await fetchPendingPayments();
      await fetchPaymentStats();

      if (showDetailModal) setShowDetailModal(false);
      if (showPaymentDetailModal) setShowPaymentDetailModal(false);
    } catch (error) {
      console.error("Payment verification error:", error);
      toast.error(
        error.response?.data?.message || "Failed to update payment status"
      );
    }
  };

  // Handle payment detail view
  const handleViewPaymentDetails = (payment) => {
    setSelectedPayment(payment);
    setShowPaymentDetailModal(true);
  };

  // Hide confirmation modal
  const hideConfirmationModal = () => {
    setConfirmationModal({
      show: false,
      type: "",
      adId: null,
      adTitle: "",
      message: "",
      rejectionReason: "",
      action: null,
    });
  };

  // Handle confirm action
  const handleConfirmAction = () => {
    const { type, adId, adTitle, rejectionReason } = confirmationModal;

    switch (type) {
      case "approve":
        updateAdStatus(adId, "approved");
        break;
      case "reject":
        if (!rejectionReason || rejectionReason.trim() === "") {
          toast.error("Please enter a rejection reason");
          return;
        }
        updateAdStatus(adId, "rejected", rejectionReason);
        break;
      case "activate":
        toggleAdActive(adId, true);
        break;
      case "pause":
        toggleAdActive(adId, false);
        break;
      default:
        hideConfirmationModal();
    }
  };

  // Helper functions
  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getPaymentStatusColor = (payment) => {
    if (!payment) return "bg-gray-100 text-gray-800";
    switch (payment.status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusText = (payment) => {
    if (!payment) return "Not Initiated";
    switch (payment.status) {
      case "completed":
        return "Paid";
      case "processing":
        return "Under Review";
      case "pending":
        return "Payment Pending";
      case "failed":
        return "Payment Failed";
      default:
        return payment.status || "Unknown";
    }
  };

  const getRemainingDays = (endDate) => {
    if (!endDate) return 0;
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewDetails = async (ad) => {
    setSelectedAd(ad);
    setShowDetailModal(true);
    if (ad.seller?._id && !sellerProfiles[ad.seller._id]) {
      await fetchSellerProfile(ad.seller._id);
    }
  };

  const exportReport = () => {
    const headers = [
      "Title",
      "Seller",
      "Status",
      "Payment Status",
      "Duration",
      "Cost",
      "Created Date",
    ];
    const csvData = filteredAds.map((ad) => [
      ad.title,
      ad.seller?.name || "Unknown",
      ad.status,
      getPaymentStatusText(ad.payment),
      `${ad.duration} days`,
      `Rs ${ad.totalCost}`,
      formatDate(ad.createdAt),
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ads-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSafeValue = (value, fallback = "Not provided") => {
    return value || fallback;
  };

  const getSellerName = (ad) => {
    return getSafeValue(ad.seller?.name, "Unknown Seller");
  };

  const getSellerEmail = (ad) => {
    return getSafeValue(ad.seller?.email, "No email");
  };

  const getSellerPhone = (ad) => {
    if (ad.seller?._id && sellerProfiles[ad.seller._id]) {
      return getSafeValue(sellerProfiles[ad.seller._id].phone, "Not available");
    }
    return "Loading...";
  };

  const getSellerBusinessInfo = (ad) => {
    if (ad.seller?._id && sellerProfiles[ad.seller._id]) {
      const profile = sellerProfiles[ad.seller._id];
      return {
        businessType: getSafeValue(profile.businessType, "Not specified"),
        city: getSafeValue(profile.city, "Not specified"),
        shopName: getSafeValue(profile.shopName, getSellerName(ad)),
        address: getSafeValue(profile.address, "Not available"),
        cnicNumber: getSafeValue(profile.cnicNumber, "Not provided"),
      };
    }
    return {
      businessType: "Loading...",
      city: "Loading...",
      shopName: getSellerName(ad),
      address: "Loading...",
      cnicNumber: "Loading...",
    };
  };

  // Confirmation Modal Component
  const ConfirmationModal = () => {
    if (!confirmationModal.show) return null;

    const getModalTitle = () => {
      switch (confirmationModal.type) {
        case "approve":
          return "Approve Advertisement";
        case "reject":
          return "Reject Advertisement";
        case "activate":
          return "Activate Advertisement";
        case "pause":
          return "Pause Advertisement";
        default:
          return "Confirm Action";
      }
    };

    const getConfirmButtonColor = () => {
      switch (confirmationModal.type) {
        case "reject":
          return "bg-red-600 hover:bg-red-700";
        case "approve":
        case "activate":
          return "bg-green-600 hover:bg-green-700";
        case "pause":
          return "bg-yellow-600 hover:bg-yellow-700";
        default:
          return "bg-primary-600 hover:bg-primary-700";
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">
              {getModalTitle()}
            </h3>
            <p className="text-neutral-600 mb-4">{confirmationModal.message}</p>

            {confirmationModal.type === "reject" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Rejection Reason
                </label>
                <textarea
                  value={confirmationModal.rejectionReason}
                  onChange={(e) =>
                    setConfirmationModal((prev) => ({
                      ...prev,
                      rejectionReason: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows="3"
                  placeholder="Enter reason for rejection..."
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={hideConfirmationModal}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition ${getConfirmButtonColor()}`}
                disabled={
                  confirmationModal.type === "reject" &&
                  !confirmationModal.rejectionReason.trim()
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Payment Detail Modal Component
  const PaymentDetailModal = () => {
    if (!showPaymentDetailModal || !selectedPayment) return null;

    const getPaymentProofUrl = () => {
      if (!selectedPayment.proofImage) return null;
      if (selectedPayment.proofImage.startsWith("http"))
        return selectedPayment.proofImage;
      if (selectedPayment.proofImage.startsWith("/"))
        return `https://nextrade-backend-production-a486.up.railway.app${selectedPayment.proofImage}`;
      return `https://nextrade-backend-production-a486.up.railway.app/uploads/${selectedPayment.proofImage}`;
    };

    const paymentProofUrl = getPaymentProofUrl();

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl">
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-800">
                Payment Verification Details
              </h2>
              <button
                onClick={() => {
                  setShowPaymentDetailModal(false);
                  setSelectedPayment(null);
                }}
                className="p-2 text-neutral-400 rounded-lg hover:bg-neutral-100 hover:text-neutral-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                    Payment Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">
                        Seller Name
                      </label>
                      <p className="mt-1 text-neutral-900 font-medium">
                        {selectedPayment.payer?.name || "Unknown Seller"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">
                        Seller Email
                      </label>
                      <p className="mt-1 text-neutral-900">
                        {selectedPayment.payer?.email || "Not available"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">
                        Payment Method
                      </label>
                      <p className="mt-1 text-neutral-900 capitalize">
                        {selectedPayment.method?.replace("_", " ") ||
                          "Bank Transfer"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">
                        Payment Status
                      </label>
                      <span
                        className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(
                          selectedPayment
                        )}`}
                      >
                        {getPaymentStatusText(selectedPayment)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">
                        Reference ID
                      </label>
                      <p className="mt-1 text-blue-600 font-medium">
                        AD
                        {selectedPayment.itemId?._id || selectedPayment.itemId}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">
                        Amount
                      </label>
                      <p className="mt-1 text-2xl font-bold text-green-600">
                        Rs {selectedPayment.amount || "0"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                    Payment Proof
                  </h3>
                  {paymentProofUrl ? (
                    <div className="border border-neutral-200 rounded-lg overflow-hidden">
                      <div className="h-64 bg-gray-100 flex items-center justify-center">
                        <img
                          src={paymentProofUrl}
                          alt="Payment proof"
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextElementSibling.style.display = "flex";
                          }}
                        />
                        <div className="hidden flex-col items-center justify-center p-6">
                          <FaImage className="text-4xl text-gray-400 mb-2" />
                          <p className="text-gray-500">Unable to load image</p>
                          <a
                            href={paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-blue-600 hover:underline"
                          >
                            Open in new tab
                          </a>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 text-center border-t border-neutral-200">
                        <a
                          href={paymentProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View Full Size Image
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center border-2 border-dashed border-red-200 rounded-lg bg-red-50">
                      <FaTimes className="mx-auto text-3xl text-red-500 mb-3" />
                      <p className="text-red-700 font-medium">
                        No payment proof uploaded
                      </p>
                      <p className="text-red-600 text-sm mt-1">
                        Seller has not provided payment screenshot
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                    Verification Actions
                  </h3>
                  <div className="space-y-3">
                    <button
                      onClick={() =>
                        handleVerifyPayment(selectedPayment._id, "verify")
                      }
                      className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <FaCheck className="mr-2" />
                      Verify Payment & Activate Ad
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt("Enter rejection reason:");
                        if (reason) {
                          API.put(
                            `/payments/admin/${selectedPayment._id}/reject`,
                            { reason }
                          )
                            .then(() => {
                              toast.success("Payment rejected");
                              setShowPaymentDetailModal(false);
                              fetchPendingPayments();
                              fetchAds();
                            })
                            .catch((error) => {
                              toast.error("Failed to reject payment");
                            });
                        }
                      }}
                      className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      <FaTimes className="mr-2" />
                      Reject Payment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto border-b-2 rounded-full animate-spin border-primary-600"></div>
          <p className="mt-4 text-neutral-600">Loading advertisements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-background-light md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-neutral-800 font-poppins md:text-3xl">
            Advertisement Management
          </h1>
          <p className="text-neutral-600">
            Manage and approve seller advertisements
          </p>
        </div>

        {error && (
          <div className="p-4 mb-6 text-red-700 bg-red-100 border border-red-300 rounded-lg">
            {error}
          </div>
        )}

        {/* Cards Style */}
        <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-5 md:gap-4 md:mb-8">
          {/* Total Ads Card */}
          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-blue-100 text-blue-600 md:p-3">
                <FaBullhorn className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Total Ads
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {stats.totalAds}
                </p>
              </div>
            </div>
          </div>

          {/* Pending Ads Card */}
          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 text-yellow-600 bg-yellow-100 rounded-full md:p-3">
                <FaClock className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Pending
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {stats.pendingAds}
                </p>
              </div>
            </div>
          </div>

          {/* Approved Ads Card */}
          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 text-green-600 bg-green-100 rounded-full md:p-3">
                <FaCheck className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Approved
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {stats.approvedAds}
                </p>
              </div>
            </div>
          </div>

          {/* Awaiting Payment Card */}
          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 text-orange-600 bg-orange-100 rounded-full md:p-3">
                <FaMoneyCheck className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Awaiting Payment
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {paymentStats.awaitingPaymentCount || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Revenue Card */}
          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 text-purple-600 bg-purple-100 rounded-full md:p-3">
                <FaMoneyBillWave className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Revenue
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  Rs {stats.totalRevenue}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-gray-100 text-gray-600 md:p-3">
                <FaReceipt className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Total Payments
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {paymentStats.totalPayments || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 text-blue-600 bg-blue-100 rounded-full md:p-3">
                <FaHourglassHalf className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Pending Review
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {paymentStats.pendingApprovalCount || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 text-green-600 bg-green-100 rounded-full md:p-3">
                <FaUserCheck className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Active
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {paymentStats.completedPayments || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 text-red-600 bg-red-100 rounded-full md:p-3">
                <FaTimes className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Rejected
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {stats.rejectedAds}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg shadow md:p-4">
            <div className="flex items-center">
              <div className="p-2 text-red-600 bg-red-100 rounded-full md:p-3">
                <FaBan className="text-sm md:text-lg" />
              </div>
              <div className="ml-3">
                <h3 className="text-xs font-medium text-neutral-600 md:text-sm">
                  Failed
                </h3>
                <p className="text-lg font-bold text-neutral-800 md:text-xl">
                  {paymentStats.failedPayments || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="flex border-b border-neutral-300 mb-6">
          <button
            className={`flex items-center px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "allAds"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-neutral-600 hover:text-neutral-800"
            }`}
            onClick={() => setActiveTab("allAds")}
          >
            <FaBullhorn className="mr-2" />
            All Advertisements
            <span className="ml-2 px-2 py-1 text-xs bg-neutral-200 text-neutral-700 rounded-full">
              {stats.totalAds}
            </span>
          </button>

          <button
            className={`flex items-center px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "paymentVerification"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-neutral-600 hover:text-neutral-800"
            }`}
            onClick={() => setActiveTab("paymentVerification")}
          >
            <FaMoneyCheck className="mr-2" />
            Payment Verification
            {pendingPayments.length > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-orange-500 text-white rounded-full">
                {pendingPayments.length} Pending
              </span>
            )}
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === "allAds" ? (
          /* All Ads Tab Content */
          <div>
            {/* Search and Filters Card */}
            <div className="p-4 mb-6 bg-white rounded-lg shadow-lg md:p-6 md:mb-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="relative max-w-md">
                    <FaSearch className="absolute transform -translate-y-1/2 text-neutral-400 left-3 top-1/2" />
                    <input
                      type="text"
                      placeholder="Search ads by title or seller..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 md:w-auto"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <button
                    onClick={exportReport}
                    className="flex items-center justify-center w-full px-4 py-3 text-white rounded-lg bg-primary-600 hover:bg-primary-700 md:w-auto"
                  >
                    <FaDownload className="mr-2" />
                    Export
                  </button>
                </div>
              </div>
            </div>

            {/* Ads Table */}
            {filteredAds.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-lg shadow md:p-12">
                <FaBullhorn className="mx-auto text-4xl text-neutral-400" />
                <h3 className="mt-4 text-lg font-medium text-neutral-900">
                  No advertisements found
                </h3>
                <p className="mt-2 text-neutral-600">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "No advertisements have been created yet"}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Ad Details
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Seller
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Duration & Cost
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Payment
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {filteredAds.map((ad) => (
                        <tr
                          key={ad._id}
                          className={`hover:bg-neutral-50 ${
                            ad.isDeleted ? "bg-red-50 opacity-70" : ""
                          }`}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-12 w-16 bg-neutral-200 rounded-lg overflow-hidden">
                                {getAdImage(ad) ? (
                                  <img
                                    src={getAdImage(ad)}
                                    alt={ad.title}
                                    className="h-12 w-16 object-cover"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.nextSibling.style.display =
                                        "flex";
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`h-12 w-16 flex items-center justify-center bg-neutral-200 ${
                                    getAdImage(ad) ? "hidden" : "flex"
                                  }`}
                                >
                                  <FaImage className="text-neutral-400" />
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-neutral-900 max-w-xs truncate">
                                  {getSafeValue(ad.title, "Untitled Ad")}
                                  {ad.isDeleted && (
                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      Deleted
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  Click "View" for details
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-neutral-900 max-w-xs truncate">
                              {getSellerName(ad)}
                            </div>
                            <div className="text-sm text-neutral-500 truncate">
                              {getSellerEmail(ad)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-neutral-900">
                              {ad.duration || 0} days
                            </div>
                            <div className="text-sm font-medium text-neutral-900">
                              Rs {ad.totalCost || 0}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col space-y-1">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  ad.isDeleted
                                    ? "bg-red-100 text-red-800"
                                    : getStatusColor(ad.status)
                                }`}
                              >
                                {ad.isDeleted
                                  ? "Deleted"
                                  : ad.status
                                  ? ad.status.charAt(0).toUpperCase() +
                                    ad.status.slice(1)
                                  : "Unknown"}
                              </span>
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  ad.isActive
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {ad.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col space-y-1">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  ad.isDeleted
                                    ? "bg-red-100 text-red-800"
                                    : getPaymentStatusColor(ad.payment)
                                }`}
                              >
                                {ad.isDeleted
                                  ? "N/A"
                                  : getPaymentStatusText(ad.payment)}
                              </span>
                              {ad.payment?.method && (
                                <span className="text-xs text-neutral-600">
                                  {ad.payment.method.replace("_", " ")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewDetails(ad)}
                                className="p-2 text-primary-600 transition rounded-lg hover:bg-secondary-200"
                                title="View Details"
                              >
                                <FaEye className="text-sm" />
                              </button>

                              {!ad.isDeleted && (
                                <>
                                  {ad.status === "pending" && (
                                    <>
                                      <button
                                        onClick={() =>
                                          showConfirmationModal(
                                            "approve",
                                            ad._id,
                                            ad.title
                                          )
                                        }
                                        className="p-2 text-green-600 transition rounded-lg hover:bg-green-100"
                                        title="Approve Ad"
                                      >
                                        <FaCheck className="text-sm" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          showConfirmationModal(
                                            "reject",
                                            ad._id,
                                            ad.title
                                          )
                                        }
                                        className="p-2 text-red-600 transition rounded-lg hover:bg-red-100"
                                        title="Reject Ad"
                                      >
                                        <FaTimes className="text-sm" />
                                      </button>
                                    </>
                                  )}

                                  {ad.status === "approved" &&
                                    ad.payment?.status === "completed" && (
                                      <button
                                        onClick={() =>
                                          showConfirmationModal(
                                            ad.isActive ? "pause" : "activate",
                                            ad._id,
                                            ad.title
                                          )
                                        }
                                        className={`p-2 transition rounded-lg ${
                                          ad.isActive
                                            ? "text-yellow-600 hover:bg-yellow-100"
                                            : "text-blue-600 hover:bg-blue-100"
                                        }`}
                                        title={
                                          ad.isActive
                                            ? "Pause Ad"
                                            : "Activate Ad"
                                        }
                                      >
                                        {ad.isActive ? (
                                          <FaBan className="text-sm" />
                                        ) : (
                                          <FaPlay className="text-sm" />
                                        )}
                                      </button>
                                    )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Payment Verification Tab Content */
          <div>
            <div className="p-4 mb-6 bg-white rounded-lg shadow md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-neutral-800">
                    Payment Verification Center
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                      <span className="text-sm text-neutral-600">
                        Awaiting Payment:{" "}
                        {paymentStats.awaitingPaymentCount || 0}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      <span className="text-sm text-neutral-600">
                        Pending Review: {paymentStats.pendingApprovalCount || 0}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-sm text-neutral-600">
                        Completed: {paymentStats.completedPayments || 0}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                    {pendingPayments.length} Require Action
                  </span>
                </div>
              </div>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-lg shadow md:p-12">
                <FaCheckDouble className="mx-auto text-4xl text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 mb-2">
                  All Payments Processed
                </h3>
                <p className="text-neutral-600 mb-4">
                  No pending payments require verification at this time.
                </p>
                <div className="inline-flex items-center space-x-4 text-sm text-neutral-500">
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Awaiting Payment: {paymentStats.awaitingPaymentCount || 0}
                  </span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    Under Review: {paymentStats.pendingApprovalCount || 0}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Seller & Ad Details
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Payment Info
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Status & Proof
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {pendingPayments.map((payment) => (
                        <tr key={payment._id} className="hover:bg-neutral-50">
                          <td className="px-4 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                <FaUser className="text-primary-600 text-sm" />
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-neutral-900">
                                  {payment.payer?.name || "Unknown Seller"}
                                </div>
                                <div className="text-sm text-neutral-500">
                                  {payment.payer?.email}
                                </div>
                                <div className="text-xs text-neutral-400 mt-1">
                                  Ad:{" "}
                                  {payment.adDetails?.title ||
                                    `AD${
                                      payment.itemId?._id || payment.itemId
                                    }`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-neutral-900">
                              <strong>Rs {payment.amount}</strong>
                            </div>
                            <div className="text-sm text-neutral-600">
                              {payment.method?.replace("_", " ") ||
                                "Bank Transfer"}
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                              Ref: AD{payment.itemId?._id || payment.itemId}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col space-y-1">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(
                                  payment
                                )}`}
                              >
                                {payment.status || "Pending Review"}
                              </span>
                              {hasPaymentProof(payment) ? (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  <FaCheck className="mr-1" size={8} />
                                  Proof Available
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                  <FaTimes className="mr-1" size={8} />
                                  No Proof
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-neutral-900">
                              {formatDate(payment.createdAt)}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {new Date(payment.createdAt).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() =>
                                  handleViewPaymentDetails(payment)
                                }
                                className="p-2 text-primary-600 transition rounded-lg hover:bg-secondary-200"
                                title="View Payment Details"
                              >
                                <FaEye className="text-sm" />
                              </button>
                              <button
                                onClick={() =>
                                  handleVerifyPayment(payment._id, "verify")
                                }
                                className="p-2 text-green-600 transition rounded-lg hover:bg-green-100"
                                title="Verify Payment"
                              >
                                <FaCheck className="text-sm" />
                              </button>
                              <button
                                onClick={() =>
                                  handleVerifyPayment(payment._id, "reject")
                                }
                                className="p-2 text-red-600 transition rounded-lg hover:bg-red-100"
                                title="Reject Payment"
                              >
                                <FaTimes className="text-sm" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ad Detail Modal - Updated image handling */}
        {showDetailModal && selectedAd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl">
              <div className="p-6 border-b border-neutral-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-neutral-800">
                    Ad Details
                  </h2>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="p-2 text-neutral-400 rounded-lg hover:bg-neutral-100 hover:text-neutral-600"
                  >
                    <FaTimes className="text-xl" />
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Left Column - Ad Information */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                        Ad Information
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700">
                            Title
                          </label>
                          <p className="mt-1 text-neutral-900">
                            {getSafeValue(selectedAd.title, "Untitled Ad")}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-neutral-700">
                            Description
                          </label>
                          <p className="mt-1 text-neutral-900 whitespace-pre-wrap break-words">
                            {getSafeValue(
                              selectedAd.description,
                              "No description"
                            )}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-neutral-700">
                            Landing Page
                          </label>
                          <p className="mt-1 text-primary-600 break-all">
                            {getSafeValue(selectedAd.link, "No link provided")}
                          </p>
                        </div>

                        <div className="bg-neutral-100 p-4 rounded-lg">
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Ad Image
                          </label>
                          {getAdImage(selectedAd) ? (
                            <img
                              src={getAdImage(selectedAd)}
                              alt={selectedAd.title}
                              className="w-full h-48 object-cover rounded-lg"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-full h-48 flex items-center justify-center bg-neutral-200 rounded-lg ${
                              getAdImage(selectedAd) ? "hidden" : "flex"
                            }`}
                          >
                            <FaImage className="text-4xl text-neutral-400" />
                            <span className="ml-2 text-neutral-500">
                              No image available
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                        Campaign Details
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Duration:</span>
                          <span className="font-medium">
                            {selectedAd.duration || 0} days
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Start Date:</span>
                          <span className="font-medium">
                            {formatDate(selectedAd.startDate)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">End Date:</span>
                          <span className="font-medium">
                            {formatDate(selectedAd.endDate)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">
                            Remaining Days:
                          </span>
                          <span className="font-medium">
                            {getRemainingDays(selectedAd.endDate)}
                          </span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-neutral-200 pt-2">
                          <span className="text-neutral-800">Total Cost:</span>
                          <span className="text-primary-600">
                            Rs {selectedAd.totalCost || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Seller Info & Actions */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                        Seller Information
                      </h3>
                      <div className="space-y-4 p-4 bg-neutral-50 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                              <FaUser className="text-primary-600 text-lg" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-900 text-lg">
                              {getSellerName(selectedAd)}
                            </h4>
                            <p className="text-neutral-600 text-sm">
                              {getSellerEmail(selectedAd)}
                            </p>
                            <p className="text-neutral-500 text-xs mt-1">
                              Member since:{" "}
                              {formatDate(selectedAd.seller?.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide">
                              Phone
                            </label>
                            <p className="text-neutral-800 font-medium mt-1">
                              {getSellerPhone(selectedAd)}
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide">
                              Store Name
                            </label>
                            <p className="text-neutral-800 font-medium mt-1">
                              {getSellerBusinessInfo(selectedAd).shopName}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-neutral-200 pt-3 mt-3">
                          <h5 className="font-medium text-neutral-700 mb-2">
                            Business Details
                          </h5>
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-neutral-600">
                                Business Type:
                              </span>
                              <span className="font-medium text-neutral-800 capitalize">
                                {getSellerBusinessInfo(selectedAd).businessType}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">City:</span>
                              <span className="font-medium text-neutral-800">
                                {getSellerBusinessInfo(selectedAd).city}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">CNIC:</span>
                              <span className="font-medium text-neutral-800">
                                {getSellerBusinessInfo(selectedAd).cnicNumber}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-neutral-200 pt-3">
                          <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                            Business Address
                          </label>
                          <p className="text-neutral-700 text-sm">
                            {getSellerBusinessInfo(selectedAd).address}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                        Status & Analytics
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600">Ad Status:</span>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              selectedAd.status
                            )}`}
                          >
                            {selectedAd.status
                              ? selectedAd.status.charAt(0).toUpperCase() +
                                selectedAd.status.slice(1)
                              : "Unknown"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600">
                            Payment Status:
                          </span>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(
                              selectedAd.payment
                            )}`}
                          >
                            {getPaymentStatusText(selectedAd.payment)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600">
                            Active Status:
                          </span>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              selectedAd.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {selectedAd.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!selectedAd.isDeleted && (
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                          Admin Actions
                        </h3>
                        <div className="space-y-3">
                          {selectedAd.status === "pending" && (
                            <div className="flex space-x-3">
                              <button
                                onClick={() =>
                                  showConfirmationModal(
                                    "approve",
                                    selectedAd._id,
                                    selectedAd.title
                                  )
                                }
                                className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <FaCheck className="mr-2" />
                                Approve Ad
                              </button>
                              <button
                                onClick={() =>
                                  showConfirmationModal(
                                    "reject",
                                    selectedAd._id,
                                    selectedAd.title
                                  )
                                }
                                className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              >
                                <FaTimes className="mr-2" />
                                Reject Ad
                              </button>
                            </div>
                          )}

                          {selectedAd.status === "approved" &&
                            selectedAd.payment?.status === "pending" && (
                              <button
                                onClick={() =>
                                  showConfirmationModal(
                                    "markPaid",
                                    selectedAd._id,
                                    selectedAd.title
                                  )
                                }
                                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <FaMoneyBillWave className="mr-2" />
                                Mark as Paid
                              </button>
                            )}

                          {selectedAd.status === "approved" &&
                            selectedAd.payment?.status === "completed" && (
                              <button
                                onClick={() =>
                                  showConfirmationModal(
                                    selectedAd.isActive ? "pause" : "activate",
                                    selectedAd._id,
                                    selectedAd.title
                                  )
                                }
                                className={`w-full flex items-center justify-center px-4 py-2 text-white rounded-lg transition-colors ${
                                  selectedAd.isActive
                                    ? "bg-yellow-600 hover:bg-yellow-700"
                                    : "bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                {selectedAd.isActive ? (
                                  <>
                                    <FaBan className="mr-2" />
                                    Pause Ad
                                  </>
                                ) : (
                                  <>
                                    <FaPlay className="mr-2" />
                                    Activate Ad
                                  </>
                                )}
                              </button>
                            )}
                        </div>
                      </div>
                    )}
                    {selectedAd.isDeleted && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h3 className="text-lg font-semibold text-red-800 mb-2">
                          Ad Deleted
                        </h3>
                        <p className="text-red-700">
                          This ad was deleted on{" "}
                          {formatDateTime(selectedAd.deletedAt)}. It remains in
                          the system for record-keeping purposes.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Detail Modal */}
        <PaymentDetailModal />
        <ConfirmationModal />
      </div>
    </div>
  );
};

export default AdminAdsManagement;
