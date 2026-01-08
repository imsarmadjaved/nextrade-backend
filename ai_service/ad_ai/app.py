from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from flask_cors import CORS
import pandas as pd
import numpy as np
import random
import os

app = Flask(__name__)
CORS(app)

def create_ad_features(ad):
    """Create features from ad data"""
    features = []
    
    # Title with high weight
    title = str(ad.get('title') or '')
    if title:
        features.extend([title] * 3)
    
    # Description
    description = str(ad.get('description') or '')
    if description:
        features.extend([description] * 2)
    
    # Tags
    tags = ad.get('tags') or []
    for tag in tags:
        features.append(str(tag))
    
    # Category
    category = ad.get('category') or ''
    if category:
        features.extend([category] * 2)
    
    return ' '.join([f for f in features if f.strip()])

@app.route('/recommend_ads', methods=['POST'])
def recommend_ads():
    try:
        data = request.get_json()
        
        # Add validation
        if not data:
            return jsonify({"error": "No data provided", "recommended_ads": []}), 400
            
        ads = data.get("ads", [])
        # Add length check
        if len(ads) == 0:
            return jsonify({"recommended_ads": []})

        # Build user profile from activities
        user_profile_parts = []
        for activity in user_activities:
            if activity.get('title'):
                user_profile_parts.append(activity['title'])
            if activity.get('description'):
                user_profile_parts.append(activity['description'])
            if activity.get('category'):
                user_profile_parts.append(activity['category'])
            for tag in activity.get('tags', []):
                user_profile_parts.append(tag)
        
        # Combine with explicit interests
        if user_interests:
            user_profile_parts.append(user_interests)
        
        user_profile = ' '.join(user_profile_parts)
        
        if not user_profile.strip():
            return jsonify({"recommended_ads": []})

        # Prepare data
        df = pd.DataFrame(ads)
        df['features'] = df.apply(create_ad_features, axis=1)
        
        # TF-IDF similarity
        tfidf = TfidfVectorizer(stop_words='english', min_df=1, max_features=1000)
        
        all_texts = [user_profile] + df['features'].tolist()
        tfidf_matrix = tfidf.fit_transform(all_texts)
        
        user_vector = tfidf_matrix[0:1]
        ad_vectors = tfidf_matrix[1:]
        
        similarities = cosine_similarity(user_vector, ad_vectors).flatten()
        
        # Get top recommendations
        df['similarity'] = similarities
        df = df.sort_values('similarity', ascending=False)
        
        # Filter by similarity threshold
        filtered_ads = df[df['similarity'] > 0.1]
        
        if len(filtered_ads) > 0:
            recommendations = filtered_ads.head(6)['_id'].tolist()
        else:
            recommendations = df.head(3)['_id'].tolist()
        
        return jsonify({
            "recommended_ads": recommendations,
            "strategy_used": "content_based",
            "user_profile_terms": len(user_profile.split()),
            "total_ads_processed": len(ads),
            "similarity_scores": df[['_id', 'similarity']].head(6).to_dict('records') 
        })
        
    except Exception as e:
        print(f"AI recommendation error: {e}")
        return jsonify({"error": str(e), "recommended_ads": []}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "ad_ai"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
