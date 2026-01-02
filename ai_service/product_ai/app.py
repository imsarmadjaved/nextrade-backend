from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from flask_cors import CORS
import pandas as pd
import numpy as np
from collections import Counter
import random
import os
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

def get_category_name(category_data):
    """Extract meaningful category name"""
    if not category_data:
        return ""
    
    if isinstance(category_data, dict):
        return category_data.get('name', '').lower().strip()
    
    # Don't use MongoDB IDs as category names
    if isinstance(category_data, str) and len(category_data) == 24:
        return ""
    
    return str(category_data).lower().strip()

def calculate_category_similarity(cat1, cat2):
    """Calculate similarity between two categories"""
    if not cat1 or not cat2:
        return 0.0
    
    # Exact match
    if cat1 == cat2:
        return 1.0
    
    # Partial match (e.g., "electronics" and "mobile electronics")
    cat1_words = set(cat1.split())
    cat2_words = set(cat2.split())
    
    if cat1_words.intersection(cat2_words):
        return 0.7
    
    return 0.0

def calculate_tag_similarity(tags1, tags2):
    """Calculate similarity between tag sets"""
    if not tags1 or not tags2:
        return 0.0
    
    tags1 = set(str(tag).lower().strip() for tag in tags1)
    tags2 = set(str(tag).lower().strip() for tag in tags2)
    
    if not tags1 or not tags2:
        return 0.0
    
    # Jaccard similarity
    intersection = len(tags1.intersection(tags2))
    union = len(tags1.union(tags2))
    
    return intersection / union if union > 0 else 0.0

def create_enhanced_features(product):
    """Create features with proper category and tag weighting"""
    features = []
    
    # Name (highest weight)
    name = str(product.get('name') or '')
    if name:
        features.extend([name] * 3)
    
    # Description
    description = str(product.get('description') or '')
    if description:
        features.append(description)
    
    # Category with emphasis
    category_name = get_category_name(product.get('category'))
    if category_name:
        features.extend([category_name] * 3)  # Higher weight for category
    
    # Tags with individual emphasis
    tags = product.get('tags') or []
    if tags:
        for tag in tags:
            tag_str = str(tag).strip()
            if tag_str:
                features.extend([tag_str] * 2)  # Each tag gets good weight
    
    return ' '.join([f for f in features if f.strip()])

def get_enhanced_recommendations(target_product, other_products, top_n=6):
    """Get recommendations using combined text + category + tag similarity"""
    
    # Prepare data
    all_products = [target_product] + other_products
    df = pd.DataFrame(all_products)
    
    # Skip if not enough products
    if len(df) <= 1:
        return []
    
    # Create enhanced features
    df['features'] = df.apply(create_enhanced_features, axis=1)
    
    # Skip if no features
    if df['features'].str.strip().eq('').all():
        return [p['_id'] for p in other_products[:top_n]]
    
    # TF-IDF for text similarity
    try:
        tfidf = TfidfVectorizer(
            stop_words='english',
            min_df=1,
            ngram_range=(1, 2),
            max_features=1000
        )
        tfidf_matrix = tfidf.fit_transform(df['features'])
        text_similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    except:
        text_similarities = np.zeros(len(other_products))
    
    # Calculate category and tag similarities
    target_category = get_category_name(target_product.get('category'))
    target_tags = target_product.get('tags') or []
    
    final_scores = []
    
    for i, product in enumerate(other_products):
        # Text similarity (50% weight)
        text_score = text_similarities[i] if i < len(text_similarities) else 0
        
        # Category similarity (30% weight)
        product_category = get_category_name(product.get('category'))
        category_score = calculate_category_similarity(target_category, product_category)
        
        # Tag similarity (20% weight)
        product_tags = product.get('tags') or []
        tag_score = calculate_tag_similarity(target_tags, product_tags)
        
        # Combined score
        combined_score = (text_score * 0.5) + (category_score * 0.3) + (tag_score * 0.2)
        
        final_scores.append((product['_id'], combined_score))
    
    # Sort by combined score and return top N
    final_scores.sort(key=lambda x: x[1], reverse=True)
    
    # Filter out very low similarity scores
    filtered_recommendations = [pid for pid, score in final_scores if score > 0.1]
    
    return filtered_recommendations[:top_n]

def get_home_page_recommendations(user_profile, all_products, top_n=12):
    """Enhanced home page recommendations with multiple strategies"""
    
    if not user_profile or len(user_profile) == 0:
        # Cold start: return popular/trending products
        return get_cold_start_recommendations(all_products, top_n)
    
    user_df = pd.DataFrame(user_profile)
    all_df = pd.DataFrame(all_products)
    
    if all_df.empty:
        return []
    
    # Strategy 1: Category-based recommendations
    category_recs = get_category_based_recommendations(user_df, all_df, max_items=4)
    
    # Strategy 2: Content-based similarity
    content_recs = get_content_based_recommendations(user_df, all_df, max_items=4)
    
    # Strategy 3: Diversity - new/trending products
    diversity_recs = get_diverse_recommendations(all_df, max_items=4)
    
    # Combine and deduplicate
    all_recommendations = category_recs + content_recs + diversity_recs
    unique_recommendations = list(dict.fromkeys(all_recommendations))
    
    return unique_recommendations[:top_n]

def get_cold_start_recommendations(all_products, top_n=12):
    """Recommendations for new users or users with no activity"""
    df = pd.DataFrame(all_products)
    
    if df.empty:
        return []
    
    # Mix of strategies for cold start
    recommendations = []
    
    # 1. Featured products (if available)
    if 'featured' in df.columns:
        featured = df[df['featured'] == True]['_id'].tolist()
        recommendations.extend(featured[:4])
    
    # 2. Recent products
    if 'createdAt' in df.columns:
        try:
            df_sorted = df.sort_values('createdAt', ascending=False)
            recent = df_sorted.head(4)['_id'].tolist()
            recommendations.extend(recent)
        except:
            recent = df.head(4)['_id'].tolist()
            recommendations.extend(recent)
    
    # 3. Random sampling for diversity
    remaining_slots = top_n - len(recommendations)
    if remaining_slots > 0:
        available_ids = [pid for pid in df['_id'].tolist() if pid not in recommendations]
        if available_ids:
            random_sample = random.sample(available_ids, min(remaining_slots, len(available_ids)))
            recommendations.extend(random_sample)
    
    return recommendations[:top_n]

def get_category_based_recommendations(user_df, all_df, max_items=4):
    """Recommend products based on user's preferred categories"""
    # Get user's category preferences
    user_categories = []
    for _, product in user_df.iterrows():
        category = get_category_name(product.get('category'))
        if category:
            user_categories.append(category)
    
    if not user_categories:
        return []
    
    # Find most common categories
    category_counter = Counter(user_categories)
    top_categories = [cat for cat, count in category_counter.most_common(3)]
    
    recommendations = []
    
    for category in top_categories:
        # Find products in this category that user hasn't seen
        category_products = []
        for _, product in all_df.iterrows():
            product_category = get_category_name(product.get('category'))
            if (product_category == category and 
                product['_id'] not in user_df['_id'].tolist()):
                category_products.append(product['_id'])
        
        # Take top 2 from each category
        recommendations.extend(category_products[:2])
    
    return recommendations[:max_items]

def get_content_based_recommendations(user_df, all_df, max_items=4):
    """Content-based filtering using TF-IDF"""
    try:
        # Combine user's products into a single profile
        user_df['features'] = user_df.apply(create_enhanced_features, axis=1)
        user_profile_text = ' '.join(user_df['features'].tolist())
        
        # Prepare candidate products (excluding user's products)
        candidate_df = all_df[~all_df['_id'].isin(user_df['_id'].tolist())]
        candidate_df['features'] = candidate_df.apply(create_enhanced_features, axis=1)
        
        if candidate_df.empty or user_df.empty:
            return []
        
        # TF-IDF similarity
        tfidf = TfidfVectorizer(stop_words='english', min_df=1, max_features=1000)
        
        # Fit on all features
        all_features = [user_profile_text] + candidate_df['features'].tolist()
        tfidf_matrix = tfidf.fit_transform(all_features)
        
        # Calculate similarity between user profile and candidate products
        user_vector = tfidf_matrix[0:1]
        candidate_vectors = tfidf_matrix[1:]
        
        similarities = cosine_similarity(user_vector, candidate_vectors).flatten()
        
        # Get top similar products
        candidate_df = candidate_df.copy()
        candidate_df['similarity'] = similarities
        candidate_df = candidate_df.sort_values('similarity', ascending=False)
        
        return candidate_df.head(max_items)['_id'].tolist()
        
    except Exception as e:
        print(f"Content-based recommendation error: {e}")
        return []

def get_diverse_recommendations(all_df, max_items=4):
    """Add diversity with new, popular, or random products"""
    recommendations = []
    
    # 1. New products
    if 'createdAt' in all_df.columns:
        try:
            new_products = all_df.sort_values('createdAt', ascending=False).head(2)
            recommendations.extend(new_products['_id'].tolist())
        except:
            pass
    
    # 2. Random selection for serendipity
    remaining = max_items - len(recommendations)
    if remaining > 0:
        available_ids = all_df['_id'].tolist()
        random_selection = random.sample(available_ids, min(remaining, len(available_ids)))
        recommendations.extend(random_selection)
    
    return recommendations[:max_items]

@app.route('/recommend', methods=['POST'])
def recommend():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"recommendations": []})

        # Product page recommendation
        if "target_product_id" in data and "products" in data:
            products_data = data["products"]
            target_id = data["target_product_id"]

            if not products_data or not target_id:
                return jsonify({"recommendations": []})

            df = pd.DataFrame(products_data)
            
            if df.empty or target_id not in df["_id"].values:
                return jsonify({"recommendations": []})

            # Get target product
            target_product = df[df["_id"] == target_id].iloc[0].to_dict()
            
            # Get other products (exclude target)
            other_products = df[df["_id"] != target_id].to_dict('records')
            
            if not other_products:
                return jsonify({"recommendations": []})

            # Get enhanced recommendations
            recommendations = get_enhanced_recommendations(target_product, other_products)
            
            return jsonify({"recommendations": recommendations})

        # Home page recommendation
        elif "user_profile" in data and "all_products" in data:
            profile_data = data.get("user_profile", [])
            all_products_data = data.get("all_products", [])
            
            if not all_products_data:
                return jsonify({"recommendations": []})

            # Get enhanced home page recommendations
            recommendations = get_home_page_recommendations(
                profile_data, 
                all_products_data,
                top_n=12
            )
            
            return jsonify({"recommendations": recommendations})

        else:
            return jsonify({"recommendations": []})

    except Exception as e:
        print(f"AI Recommendation error: {e}")
        return jsonify({"recommendations": []})

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
