from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd

app = Flask(__name__)

@app.route('/recommend_ads', methods=['POST'])
def recommend_ads():
    try:
        data = request.get_json()

        ads = data.get("ads", [])
        user_interests = data.get("interests", "")

        if not ads or not user_interests:
            return jsonify({"error": "Missing ads or interests"}), 400
        
        df = pd.DataFrame(ads)
        df['combined_text'] = df['title'] + " " + df['description'] + " " + df['tags'].apply(lambda x: " ".join(x))

        # Vectorization
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(df['combined_text'])
        user_vector = vectorizer.transform([user_interests])

        # Compute similarity
        similarity_scores = cosine_similarity(user_vector, tfidf_matrix).flatten()

        # Get top 5 ads
        top_indices = similarity_scores.argsort()[-5:][::-1]
        recommended_ads = df.iloc[top_indices]['_id'].tolist()

        return jsonify({
            "recommended_ads": recommended_ads
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5001)
